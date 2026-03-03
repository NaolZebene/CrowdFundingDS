// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20V {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ICommitToken {
    function mint(address to, uint256 amount) external;
    function balanceOf(address who) external view returns (uint256);
}

interface ILender {
    function supply(uint256 amount) external;
    function withdraw(uint256 amount, address to) external;
    function balance() external view returns (uint256);
}

interface IOracle {
    function milestoneOk(uint256 milestone) external view returns (bool);
}

interface IZKVerifier {
    function verify(address user, bytes calldata proof) external view returns (bool);
}

contract CrowdVault {
    // roles
    address public founder;
    address public treasury; // multisig CONTRACT address

    // tokens + modules
    IERC20V public immutable usdc;
    ICommitToken public immutable commit;

    ILender public lender;       // Aave adapter or mock
    IOracle public oracle;       // Chainlink adapter or mock
    IZKVerifier public zk;       // ZK-KYC verifier or mock

    // funding
    uint256 public totalRaised;
    mapping(address => uint256) public principalOf;

    // milestones/tranches
    uint256 public immutable milestoneCount;
    uint256 public currentMilestone;
    uint256 public totalReleased;

    // optimistic veto
    uint256 public constant VETO_WINDOW = 2 minutes;
    uint256 public releaseRequestedAt; // 0 => no active request
    bool public releaseVetoed;

    // yield distribution (index model)
    uint256 public constant ONE = 1e18;
    uint256 public yieldIndex = ONE;
    mapping(address => uint256) public userIndex;
    mapping(address => uint256) public claimableYield;

    // events (audit trail)
    event Invested(address indexed investor, uint256 amount);

    event MilestoneVerified(uint256 indexed milestone);
    event ReleaseRequested(uint256 indexed milestone, uint256 requestedAt);
    event Vetoed(address indexed by);
    event VetoCleared(address indexed byTreasury);

    event FundsReleased(uint256 indexed milestone, uint256 amount, address treasury);

    event YieldHarvested(uint256 yieldAmount, uint256 newYieldIndex);
    event YieldClaimed(address indexed user, uint256 amount);

    event LenderSet(address lender);
    event OracleSet(address oracle);
    event ZkSet(address zk);

    modifier onlyFounder() {
        require(msg.sender == founder, "not founder");
        _;
    }

    constructor(
        address usdc_,
        address treasury_,
        address commit_,
        uint256 milestoneCount_
    ) {
        require(usdc_ != address(0) && treasury_ != address(0) && commit_ != address(0), "bad addr");
        require(milestoneCount_ > 0, "bad milestones");

        founder = msg.sender;
        treasury = treasury_;
        usdc = IERC20V(usdc_);
        commit = ICommitToken(commit_);
        milestoneCount = milestoneCount_;
    }

    // ---- wiring external systems ----

    function setLender(address lender_) external onlyFounder {
        lender = ILender(lender_);
        emit LenderSet(lender_);
    }

    function setOracle(address oracle_) external onlyFounder {
        oracle = IOracle(oracle_);
        emit OracleSet(oracle_);
    }

    function setZk(address zk_) external onlyFounder {
        zk = IZKVerifier(zk_);
        emit ZkSet(zk_);
    }

    // ---- invest (stablecoin only) + KYC gate ----

    function invest(uint256 amount, bytes calldata proof) external {
        require(amount > 0, "amount=0");

        // If zk module set, enforce KYC (proof not stored on-chain)
        if (address(zk) != address(0)) {
            require(zk.verify(msg.sender, proof), "KYC failed");
        }

        _accrue(msg.sender);

        require(usdc.transferFrom(msg.sender, address(this), amount), "tf");
        principalOf[msg.sender] += amount;
        totalRaised += amount;

        // Mint commitment tokens 1:1 (receipt token)
        commit.mint(msg.sender, amount);

        // Optional: deposit idle funds into lender
        if (address(lender) != address(0)) {
            usdc.approve(address(lender), amount);
            lender.supply(amount);
        }

        emit Invested(msg.sender, amount);
    }

    // ---- yield accounting ----

    function _accrue(address user) internal {
        uint256 p = principalOf[user];
        uint256 last = userIndex[user];
        if (last == 0) last = ONE;

        if (p > 0 && yieldIndex > last) {
            uint256 add = (p * (yieldIndex - last)) / ONE;
            claimableYield[user] += add;
        }
        userIndex[user] = yieldIndex;
    }

    // Anyone can harvest yield (pulls surplus from lender and updates global index)
    function harvestYield() external {
        require(address(lender) != address(0), "no lender");

        uint256 lockedPrincipal = totalRaised - totalReleased;
        uint256 lenderBal = lender.balance();
        if (lenderBal <= lockedPrincipal) return;

        uint256 yieldAmt = lenderBal - lockedPrincipal;
        lender.withdraw(yieldAmt, address(this));

        if (totalRaised > 0) {
            yieldIndex += (yieldAmt * ONE) / totalRaised;
        }

        emit YieldHarvested(yieldAmt, yieldIndex);
    }

    function claimYield() external {
        _accrue(msg.sender);

        uint256 amt = claimableYield[msg.sender];
        require(amt > 0, "no yield");
        claimableYield[msg.sender] = 0;

        // Ensure vault has enough USDC; if not, pull from lender
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < amt && address(lender) != address(0)) {
            lender.withdraw(amt - bal, address(this));
        }

        require(usdc.transfer(msg.sender, amt), "transfer");
        emit YieldClaimed(msg.sender, amt);
    }

    // ---- milestone proof ----

    function verifyNextMilestone() external onlyFounder {
        require(currentMilestone < milestoneCount, "done");
        require(releaseRequestedAt == 0, "release pending");

        uint256 next = currentMilestone + 1;

        // If oracle set, require oracle approval
        if (address(oracle) != address(0)) {
            require(oracle.milestoneOk(next), "oracle not ok");
        }

        currentMilestone = next;
        emit MilestoneVerified(currentMilestone);
    }

    // ---- optimistic veto window ----

    function requestRelease() external onlyFounder {
        require(currentMilestone > 0, "no milestone");
        require(releaseRequestedAt == 0, "already requested");
        require(!releaseVetoed, "vetoed");

        releaseRequestedAt = block.timestamp;
        emit ReleaseRequested(currentMilestone, releaseRequestedAt);
    }

    // Backers veto (commit token holders)
    function veto() external {
        require(commit.balanceOf(msg.sender) > 0, "only backers");
        require(releaseRequestedAt != 0, "no request");
        require(block.timestamp < releaseRequestedAt + VETO_WINDOW, "window over");
        require(!releaseVetoed, "already vetoed");

        releaseVetoed = true;
        emit Vetoed(msg.sender);
    }

  
    // Founder cannot clear veto. Only the treasury multisig contract can clear it.
    // Clearing cancels the request; founder must request again (new veto window).
    function clearVeto() external {
        require(msg.sender == treasury, "only treasury multisig");
        require(releaseVetoed, "not vetoed");

        releaseVetoed = false;
        releaseRequestedAt = 0;

        emit VetoCleared(msg.sender);
    }

    // ---- tranche math ----

    function releasable() public view returns (uint256) {
        uint256 tranche = totalRaised / milestoneCount;
        uint256 unlocked = tranche * currentMilestone;

        if (unlocked > totalRaised) unlocked = totalRaised;
        if (unlocked <= totalReleased) return 0;

        return unlocked - totalReleased;
    }

    function executeRelease() external {
        require(releaseRequestedAt != 0, "no request");
        require(!releaseVetoed, "vetoed");
        require(block.timestamp >= releaseRequestedAt + VETO_WINDOW, "wait veto window");

        uint256 amt = releasable();
        require(amt > 0, "nothing");

        totalReleased += amt;
        releaseRequestedAt = 0;
        releaseVetoed = false;

        // Ensure vault has enough USDC; if not, pull from lender
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < amt && address(lender) != address(0)) {
            lender.withdraw(amt - bal, address(this));
        }

        require(usdc.transfer(treasury, amt), "transfer");
        emit FundsReleased(currentMilestone, amt, treasury);
    }
}
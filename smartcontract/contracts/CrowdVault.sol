// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20V {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ICommitToken {
    function mint(uint256 projectId, address to, uint256 amount) external;
    function burn(uint256 projectId, address from, uint256 amount) external;
    function balanceOf(
        address user,
        uint256 projectId
    ) external view returns (uint256);
}

interface ILender {
    function supply(uint256 amount) external;
    function withdraw(uint256 amount, address to) external;
    function balance() external view returns (uint256);
}

interface IOracle {
    function milestoneOk(
        uint256 projectId,
        uint256 milestone
    ) external view returns (bool);
}

interface IZKVerifier {
    function verify(
        address user,
        bytes calldata proof
    ) external view returns (bool);
}

interface IRevenueRouter {
    function onRevenue(uint256 amount) external;
}

contract CrowdVault {
    // ---- custom errors ----
    error NotAdmin();
    error NotProjectFounder();
    error NotPendingAdmin();
    error NotBacker();
    error NotTreasury();
    error BadAddress();
    error BadProject();
    error BadMilestones();
    error BadDeadline();
    error ZeroAmount();
    error TransferFailed();
    error ProjectComplete();
    error ReleasePending();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error KYCFailed();
    error GoalWasMet();
    error NothingToRefund();
    error FundingGoalNotMet();
    error NoLender();
    error NoYield();
    error MilestoneDone();
    error OracleNotOk();
    error NoMilestone();
    error AlreadyRequested();
    error VetoActive();
    error AlreadyVetoed();
    error AlreadyVoted();
    error InsufficientStake();
    error NoRequest();
    error VetoWindowOver();
    error VetoWindowNotOver();
    error NotVetoed();
    error NothingToRelease();
    error ProjectNotApproved();

    // ---- roles ----
    address public admin;
    address public pendingAdmin;

    // ---- modules ----
    IERC20V public immutable usdc;
    ICommitToken public immutable commit;
    ILender public lender;
    IOracle public oracle;
    mapping(address => bool) public approvedZK;
    address public revenueRouter;

    // ---- constants ----
    uint256 public constant VETO_WINDOW = 3 days;
    uint256 public constant MIN_FUNDING_DEADLINE = 3 days;
    uint256 public constant DEFAULT_FUNDING_DEADLINE = 30 days;
    uint256 public constant MAX_FUNDING_DEADLINE = 90 days;
    uint256 public constant VETO_THRESHOLD_BPS = 3000; // 30% stake required to veto
    uint256 public constant ONE = 1e18;

    // ---- project state ----
    struct Project {
        address founder;
        address treasury;
        uint256 milestoneCount;
        uint256 totalRaised;
        uint256 totalReleased;
        uint256 currentMilestone;
        uint256 releaseRequestedAt;
        bool releaseVetoed;
        string metadataUri;
        uint256 fundingGoal;
        uint256 fundingDeadline;
        bool approved;
        string name;
        string description;
        string additionalFilesUrl;
    }

    uint256 public projectCount;
    mapping(uint256 => Project) public projects;
    mapping(address => uint256[]) public founderProjects;

    // ---- veto voting ----
    mapping(uint256 => uint256) public vetoVotes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => address[]) public vetoVoters;

    // ---- fees ----
    uint256 public projectSubmissionFee;
    uint256 public releaseFeeBps; // e.g. 100 = 1%

    // ---- global accounting ----
    uint256 public activeReleaseCount;
    uint256 public totalRaised;
    uint256 public totalReleasedGlobal;

    // ---- user project tracking (for yield) ----
    mapping(address => uint256[]) public userProjects;
    mapping(address => mapping(uint256 => bool)) public inUserProjects;

    // ---- yield ----
    uint256 public yieldIndex = ONE;
    mapping(address => uint256) public userIndex;
    mapping(address => uint256) public claimableYield;

    // ---- events ----
    event ProjectCreated(
        uint256 indexed projectId,
        address founder,
        address treasury,
        uint256 milestoneCount,
        string metadataUri,
        string name,
        string description,
        string additionalFilesUrl
    );

    event Invested(
        uint256 indexed projectId,
        address indexed investor,
        uint256 amount
    );

    event Refunded(
        uint256 indexed projectId,
        address indexed investor,
        uint256 amount
    );

    event MilestoneVerified(
        uint256 indexed projectId,
        uint256 indexed milestone
    );

    event ReleaseRequested(
        uint256 indexed projectId,
        uint256 indexed milestone,
        uint256 requestedAt
    );

    event VetoedEvent(uint256 indexed projectId, address indexed by);
    event VetoCleared(uint256 indexed projectId, address indexed byTreasury);
    event FundsReleased(
        uint256 indexed projectId,
        uint256 indexed milestone,
        uint256 amount,
        address treasury
    );
    event YieldHarvested(uint256 yieldAmount, uint256 newYieldIndex);
    event YieldClaimed(address indexed user, uint256 amount);
    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event ProjectApproved(uint256 indexed projectId);
    event SubmissionFeeSet(uint256 fee);
    event ReleaseFeeSet(uint256 bps);
    event RevenueRouterSet(address revenueRouter);
    event LenderSet(address lender);
    event OracleSet(address oracle);
    event ZkAdded(address zk);
    event ZkRemoved(address zk);
    event ProjectRegistered(uint256 indexed projectId, address indexed user);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyProjectFounder(uint256 projectId) {
        if (projectId == 0 || projectId > projectCount) revert BadProject();
        if (projects[projectId].founder != msg.sender)
            revert NotProjectFounder();
        _;
    }

    modifier validProject(uint256 projectId) {
        if (projectId == 0 || projectId > projectCount) revert BadProject();
        _;
    }

    function isAdmin(address user) external view returns (bool) {
        return user == admin;
    }

    constructor(address usdc_, address commit_) {
        if (usdc_ == address(0) || commit_ == address(0)) revert BadAddress();
        admin = msg.sender;
        usdc = IERC20V(usdc_);
        commit = ICommitToken(commit_);
    }

    function setSubmissionFee(uint256 fee) external onlyAdmin {
        projectSubmissionFee = fee;
        emit SubmissionFeeSet(fee);
    }

    function setReleaseFeeBps(uint256 bps) external onlyAdmin {
        require(bps <= 1000, "max 10%");
        releaseFeeBps = bps;
        emit ReleaseFeeSet(bps);
    }

    function setRevenueRouter(address revenueRouter_) external onlyAdmin {
        if (revenueRouter_ == address(0)) revert BadAddress();
        revenueRouter = revenueRouter_;
        emit RevenueRouterSet(revenueRouter_);
    }

    function setLender(address lender_) external onlyAdmin {
        if (address(lender) != address(0)) {
            uint256 bal = lender.balance();
            if (bal > 0) {
                lender.withdraw(bal, address(this));
            }
        }
        lender = ILender(lender_);
        if (lender_ != address(0)) {
            uint256 vaultBal = usdc.balanceOf(address(this));
            if (vaultBal > 0) {
                usdc.approve(lender_, vaultBal);
                lender.supply(vaultBal);
            }
        }
        emit LenderSet(lender_);
    }

    function setOracle(address oracle_) external onlyAdmin {
        if (activeReleaseCount > 0) revert ReleasePending();
        oracle = IOracle(oracle_);
        emit OracleSet(oracle_);
    }

    function addZK(address zk_) external onlyAdmin {
        if (zk_ == address(0)) revert BadAddress();
        approvedZK[zk_] = true;
        emit ZkAdded(zk_);
    }

    function removeZK(address zk_) external onlyAdmin {
        approvedZK[zk_] = false;
        emit ZkRemoved(zk_);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert BadAddress();
        pendingAdmin = newAdmin;
        emit AdminTransferInitiated(newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        emit AdminTransferred(admin, pendingAdmin);
        admin = pendingAdmin;
        pendingAdmin = address(0);
    }

    function createProject(
        address treasury_,
        uint256 milestoneCount_,
        string calldata name_,
        string calldata description_,
        string calldata additionalFilesUrl_,
        string calldata metadataUri_,
        uint256 fundingGoal_,
        uint256 fundingDeadline_
    ) external returns (uint256 projectId) {
        if (treasury_ == address(0)) revert BadAddress();
        if (milestoneCount_ == 0) revert BadMilestones();
        if (fundingDeadline_ == 0) {
            fundingDeadline_ = block.timestamp + DEFAULT_FUNDING_DEADLINE;
        } else if (
            fundingDeadline_ < block.timestamp + MIN_FUNDING_DEADLINE ||
            fundingDeadline_ > block.timestamp + MAX_FUNDING_DEADLINE
        ) revert BadDeadline();

        if (projectSubmissionFee > 0) {
            if (!usdc.transferFrom(msg.sender, admin, projectSubmissionFee))
                revert TransferFailed();
        }

        projectCount++;
        projectId = projectCount;
        Project storage p = projects[projectId];
        p.founder = msg.sender;
        p.treasury = treasury_;
        p.milestoneCount = milestoneCount_;
        p.totalRaised = 0;
        p.totalReleased = 0;
        p.currentMilestone = 0;
        p.releaseRequestedAt = 0;
        p.releaseVetoed = false;
        p.metadataUri = metadataUri_;
        p.fundingGoal = fundingGoal_;
        p.fundingDeadline = fundingDeadline_;
        p.approved = false;
        p.name = name_;
        p.description = description_;
        p.additionalFilesUrl = additionalFilesUrl_;
        founderProjects[msg.sender].push(projectId);

        emit ProjectCreated(
            projectId,
            msg.sender,
            treasury_,
            milestoneCount_,
            metadataUri_,
            name_,
            description_,
            additionalFilesUrl_
        );
    }

    function approveProject(
        uint256 projectId
    ) external onlyAdmin validProject(projectId) {
        projects[projectId].approved = true;
        emit ProjectApproved(projectId);
    }

    // Called by AMM buyers to register their project for yield tracking
    function registerProject(
        uint256 projectId
    ) external validProject(projectId) {
        if (commit.balanceOf(msg.sender, projectId) == 0) revert NotBacker();
        if (!inUserProjects[msg.sender][projectId]) {
            _accrue(msg.sender);
            inUserProjects[msg.sender][projectId] = true;
            userProjects[msg.sender].push(projectId);
            emit ProjectRegistered(projectId, msg.sender);
        }
    }

    function invest(
        uint256 projectId,
        uint256 amount,
        bytes calldata proof
    ) external validProject(projectId) {
        if (amount == 0) revert ZeroAmount();
        Project storage proj = projects[projectId];
        if (!proj.approved) revert ProjectNotApproved();
        if (proj.currentMilestone >= proj.milestoneCount)
            revert ProjectComplete();
        if (proj.releaseRequestedAt != 0) revert ReleasePending();
        if (proj.fundingDeadline != 0 && block.timestamp > proj.fundingDeadline)
            revert DeadlinePassed();
        if (proof.length > 0) {
            (address zkAddr) = abi.decode(proof[:20], (address));
            if (!approvedZK[zkAddr]) revert KYCFailed();
            if (!IZKVerifier(zkAddr).verify(msg.sender, proof[20:]))
                revert KYCFailed();
        }

        _accrue(msg.sender);

        if (!usdc.transferFrom(msg.sender, address(this), amount))
            revert TransferFailed();
        proj.totalRaised += amount;
        totalRaised += amount;

        if (!inUserProjects[msg.sender][projectId]) {
            inUserProjects[msg.sender][projectId] = true;
            userProjects[msg.sender].push(projectId);
        }

        commit.mint(projectId, msg.sender, amount);

        if (address(lender) != address(0)) {
            usdc.approve(address(lender), amount);
            lender.supply(amount);
        }

        emit Invested(projectId, msg.sender, amount);
    }

    function refund(uint256 projectId) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (block.timestamp <= proj.fundingDeadline) revert DeadlineNotPassed();
        if (proj.fundingGoal == 0) revert FundingGoalNotMet();
        if (proj.totalRaised >= proj.fundingGoal) revert GoalWasMet();

        uint256 amt = commit.balanceOf(msg.sender, projectId);
        if (amt == 0) revert NothingToRefund();

        _accrue(msg.sender);
        commit.burn(projectId, msg.sender, amt);
        proj.totalRaised -= amt;
        totalRaised -= amt;

        _withdrawAndTransfer(msg.sender, amt);
        emit Refunded(projectId, msg.sender, amt);
    }

    function _totalStake(address user) internal view returns (uint256 total) {
        uint256[] storage projs = userProjects[user];
        for (uint256 i = 0; i < projs.length; i++) {
            total += commit.balanceOf(user, projs[i]);
        }
    }

    function _accrue(address user) internal {
        uint256 p = _totalStake(user);
        uint256 last = userIndex[user] == 0 ? ONE : userIndex[user];
        if (p > 0 && yieldIndex > last) {
            claimableYield[user] += (p * (yieldIndex - last)) / ONE;
        }
        userIndex[user] = yieldIndex;
    }

    function harvestYield() external {
        if (address(lender) == address(0)) revert NoLender();
        uint256 lockedPrincipal = totalRaised - totalReleasedGlobal;
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
        if (amt == 0) revert NoYield();
        claimableYield[msg.sender] = 0;
        _withdrawAndTransfer(msg.sender, amt);
        emit YieldClaimed(msg.sender, amt);
    }

    function verifyNextMilestone(
        uint256 projectId
    ) external onlyProjectFounder(projectId) {
        Project storage proj = projects[projectId];
        if (proj.currentMilestone >= proj.milestoneCount)
            revert MilestoneDone();
        if (proj.releaseRequestedAt != 0) revert ReleasePending();
        if (proj.fundingGoal != 0 && proj.totalRaised < proj.fundingGoal)
            revert FundingGoalNotMet();
        uint256 next = proj.currentMilestone + 1;
        if (
            address(oracle) != address(0) &&
            !oracle.milestoneOk(projectId, next)
        ) revert OracleNotOk();
        proj.currentMilestone = next;
        emit MilestoneVerified(projectId, next);
    }

    // ---- release ----
    function requestRelease(
        uint256 projectId
    ) external onlyProjectFounder(projectId) {
        Project storage proj = projects[projectId];
        if (proj.currentMilestone == 0) revert NoMilestone();
        if (proj.releaseRequestedAt != 0) revert AlreadyRequested();
        if (proj.releaseVetoed) revert VetoActive();
        proj.releaseRequestedAt = block.timestamp;
        activeReleaseCount++;
        emit ReleaseRequested(
            projectId,
            proj.currentMilestone,
            proj.releaseRequestedAt
        );
    }

    function veto(uint256 projectId) external validProject(projectId) {
        uint256 stake = commit.balanceOf(msg.sender, projectId);
        if (stake == 0) revert NotBacker();
        Project storage proj = projects[projectId];
        if (proj.releaseRequestedAt == 0) revert NoRequest();
        if (block.timestamp >= proj.releaseRequestedAt + VETO_WINDOW)
            revert VetoWindowOver();
        if (proj.releaseVetoed) revert AlreadyVetoed();
        if (hasVoted[projectId][msg.sender]) revert AlreadyVoted();

        hasVoted[projectId][msg.sender] = true;
        vetoVoters[projectId].push(msg.sender);
        vetoVotes[projectId] += stake;

        if (
            vetoVotes[projectId] * 10_000 >=
            proj.totalRaised * VETO_THRESHOLD_BPS
        ) {
            proj.releaseVetoed = true;
        }

        emit VetoedEvent(projectId, msg.sender);
    }

    function clearVeto(uint256 projectId) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (msg.sender != proj.treasury) revert NotTreasury();
        if (!proj.releaseVetoed) revert NotVetoed();
        proj.releaseVetoed = false;
        proj.releaseRequestedAt = 0;
        vetoVotes[projectId] = 0;
        address[] storage voters = vetoVoters[projectId];
        for (uint256 i = 0; i < voters.length; i++) {
            hasVoted[projectId][voters[i]] = false;
        }
        delete vetoVoters[projectId];
        activeReleaseCount--;
        emit VetoCleared(projectId, msg.sender);
    }

    function releasable(uint256 projectId) public view returns (uint256) {
        Project storage proj = projects[projectId];
        if (proj.founder == address(0)) return 0;
        uint256 unlocked = proj.currentMilestone == proj.milestoneCount
            ? proj.totalRaised
            : (proj.totalRaised / proj.milestoneCount) * proj.currentMilestone;
        if (unlocked <= proj.totalReleased) return 0;
        return unlocked - proj.totalReleased;
    }

    function executeRelease(
        uint256 projectId
    ) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (proj.releaseRequestedAt == 0) revert NoRequest();
        if (proj.releaseVetoed) revert VetoActive();
        if (block.timestamp < proj.releaseRequestedAt + VETO_WINDOW)
            revert VetoWindowNotOver();
        uint256 amt = releasable(projectId);
        if (amt == 0) revert NothingToRelease();

        proj.totalReleased += amt;
        totalReleasedGlobal += amt;
        proj.releaseRequestedAt = 0;
        proj.releaseVetoed = false;
        activeReleaseCount--;

        if (releaseFeeBps > 0 && revenueRouter != address(0)) {
            uint256 fee = (amt * releaseFeeBps) / 10_000;
            uint256 toTreasury = amt - fee;
            _withdrawAndTransfer(proj.treasury, toTreasury);
            _withdrawAndTransfer(address(this), fee);
            usdc.approve(revenueRouter, fee);
            IRevenueRouter(revenueRouter).onRevenue(fee);
        } else {
            _withdrawAndTransfer(proj.treasury, amt);
        }
        emit FundsReleased(
            projectId,
            proj.currentMilestone,
            amt,
            proj.treasury
        );
    }

    function _withdrawAndTransfer(address to, uint256 amt) internal {
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < amt && address(lender) != address(0)) {
            lender.withdraw(amt - bal, address(this));
        }
        if (!usdc.transfer(to, amt)) revert TransferFailed();
    }

    function getCommitmentBreakdown(
        address user,
        uint256 offset,
        uint256 limit
    )
        external
        view
        returns (uint256[] memory projectIds, uint256[] memory amounts)
    {
        uint256 n = projectCount;
        if (offset >= n) return (new uint256[](0), new uint256[](0));
        uint256 end = offset + limit > n ? n : offset + limit;
        uint256 len = end - offset;
        projectIds = new uint256[](len);
        amounts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 pid = offset + i + 1;
            projectIds[i] = pid;
            amounts[i] = commit.balanceOf(user, pid);
        }
    }

    function getProjectsByFounder(
        address founder_
    ) external view returns (uint256[] memory) {
        return founderProjects[founder_];
    }
}

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
    function totalSupplyByProject(
        uint256 projectId
    ) external view returns (uint256);
}

interface ILender {
    function supply(uint256 amount) external;
    function withdraw(uint256 amount, address to) external;
    function withdrawYield(uint256 amount, address to) external;
    function balance() external view returns (uint256);
}

interface IRevenueRouter {
    function onRevenue(uint256 amount) external;
}

interface ICommitmentAMM {
    function seeded(uint256 projectId) external view returns (bool);
    function seedFromVault(
        uint256 projectId,
        uint256 usdcIn,
        uint256 commitIn
    ) external;
}

contract CrowdVault {

    // ---- errors ----

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
    error GoalWasMet();
    error NothingToRefund();
    error FundingGoalNotMet();
    error NoLender();
    error NoYield();
    error MilestoneDone();
    error NoMilestone();
    error AlreadyRequested();
    error VetoActive();
    error AlreadyVetoed();
    error AlreadyVoted();
    error NoRequest();
    error VetoWindowOver();
    error VetoWindowNotOver();
    error NotVetoed();
    error NothingToRelease();
    error ProjectNotApproved();
    error MilestoneWindowTooShort();
    error MilestoneWindowTooLong();
    error MilestoneDeadlineNotPassed();
    error TimeoutAlreadyOpen();
    error NoTimeoutOpen();
    error TimeoutWindowNotOver();
    error AlreadyVotedTimeout();
    error ProjectDead();
    error NotAMM();

    // ---- constants ----

    uint256 public constant VETO_WINDOW = 3 days;
    uint256 public constant DEFAULT_FUNDING_DEADLINE = 30 days;
    uint256 public constant MAX_FUNDING_DEADLINE = 90 days;
    uint256 public constant VETO_THRESHOLD_BPS = 3000; 
    uint256 public constant APPROVAL_THRESHOLD_BPS = 3000; 
    uint256 public constant ONE = 1e18;
    uint256 public constant MIN_MILESTONE_WINDOW = 7 days;
    uint256 public constant MAX_MILESTONE_WINDOW = 180 days;
    uint256 public constant TIMEOUT_VOTE_WINDOW = 3 days;

    // ---- structs ----

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
        string iconUrl;
        uint256 totalAmmSeeded;
        uint256 milestoneWindow; 
        uint256 milestoneDeadline; 
        bool timeoutActive; 
        uint256 timeoutOpenedAt; 
        bool projectDead; 
        bool releaseApproved; 
    }

    // ---- admin state ----

    address public admin;
    address public pendingAdmin;
    uint256 public projectSubmissionFee;
    uint256 public releaseFeeBps; 

    // ---- core token interfaces ----

    IERC20V public immutable usdc;
    ICommitToken public immutable commit;

    // ---- lender state ----

    ILender public lender;

    // ---- revenue router state ----

    address public revenueRouter;

    // ---- AMM state ----

    ICommitmentAMM public amm;
    uint256 public ammSeedBps = 1000; 

    // ---- project state ----

    uint256 public projectCount;
    mapping(uint256 => Project) public projects;
    mapping(address => uint256[]) public founderProjects;

    // ---- veto voting state ----

    mapping(uint256 => uint256) public vetoVotes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public votedStake;
    mapping(uint256 => address[]) public vetoVoters;

    // ---- release approval voting state ----

    mapping(uint256 => uint256) public approveVotes;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(uint256 => mapping(address => uint256)) public approvedStake;
    mapping(uint256 => address[]) public approveVoters;

    // ---- milestone timeout voting state ----

    mapping(uint256 => uint256) public timeoutVotesExtend;
    mapping(uint256 => uint256) public timeoutVotesRefund;
    mapping(uint256 => mapping(address => bool)) public hasVotedTimeout;
    mapping(uint256 => mapping(address => uint256)) public timeoutVotedStake;
    mapping(uint256 => address[]) public timeoutVoters;

    // ---- global accounting ----

    uint256 public activeReleaseCount;
    uint256 public totalRaised;
    uint256 public totalReleasedGlobal;
    uint256 public totalAmmSeededGlobal;

    // ---- yield state ----

    uint256 public yieldIndex = ONE;
    mapping(address => uint256) public userIndex;
    mapping(address => uint256) public claimableYield;

    // ---- user project tracking (for yield) ----

    mapping(address => uint256[]) public userProjects;
    mapping(address => mapping(uint256 => bool)) public inUserProjects;

    // ---- events: project lifecycle ----

    event ProjectCreated(
        uint256 indexed projectId,
        address founder,
        address treasury,
        uint256 milestoneCount,
        string metadataUri,
        string name,
        string description,
        string additionalFilesUrl,
        string iconUrl
    );
    event ProjectApproved(uint256 indexed projectId);
    event ProjectRegistered(uint256 indexed projectId, address indexed user);

    // ---- events: investment ----

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

    // ---- events: milestone ----

    event MilestoneVerified(
        uint256 indexed projectId,
        uint256 indexed milestone
    );
    event MilestoneTimeoutOpened(uint256 indexed projectId, uint256 deadline);
    event TimeoutVoteCast(
        uint256 indexed projectId,
        address indexed voter,
        bool extend,
        uint256 stake
    );
    event TimeoutResolved(uint256 indexed projectId, bool extended);

    // ---- events: release ----

    event ReleaseRequested(
        uint256 indexed projectId,
        uint256 indexed milestone,
        uint256 requestedAt
    );
    event ReleaseApproved(uint256 indexed projectId, address indexed by);
    event ReleaseApprovedThresholdMet(uint256 indexed projectId);
    event FundsReleased(
        uint256 indexed projectId,
        uint256 indexed milestone,
        uint256 amount,
        address treasury
    );

    // ---- events: veto ----

    event VetoedEvent(uint256 indexed projectId, address indexed by);
    event VetoCancelled(uint256 indexed projectId, address indexed by);
    event VetoCleared(uint256 indexed projectId, address indexed byTreasury);

    // ---- events: lender / yield ----

    event YieldHarvested(uint256 yieldAmount, uint256 newYieldIndex);
    event YieldClaimed(address indexed user, uint256 amount);
    event LenderSet(address lender);

    // ---- events: AMM ----

    event AmmSet(address amm);
    event AmmSeedBpsSet(uint256 bps);
    event AmmSeeded(
        uint256 indexed projectId,
        uint256 usdcIn,
        uint256 commitIn
    );

    // ---- events: admin ----

    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event SubmissionFeeSet(uint256 fee);
    event ReleaseFeeSet(uint256 bps);
    event RevenueRouterSet(address revenueRouter);

    // ---- modifiers ----

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

    // ---- constructor ----

    constructor(address usdc_, address commit_, address revenueRouter_) {
        if (
            usdc_ == address(0) ||
            commit_ == address(0) ||
            revenueRouter_ == address(0)
        ) revert BadAddress();
        admin = msg.sender;
        usdc = IERC20V(usdc_);
        commit = ICommitToken(commit_);
        revenueRouter = revenueRouter_;
    }

    // ---- admin config ----

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

    function isAdmin(address user) external view returns (bool) {
        return user == admin;
    }

    // ---- lender config ----

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

    // ---- AMM config ----

    function setAMM(address amm_) external onlyAdmin {
        if (amm_ == address(0)) revert BadAddress();
        amm = ICommitmentAMM(amm_);
        emit AmmSet(amm_);
    }

    function setAmmSeedBps(uint256 bps) external onlyAdmin {
        require(bps <= 3000, "max 30%");
        ammSeedBps = bps;
        emit AmmSeedBpsSet(bps);
    }

    // ---- project lifecycle ----

    function createProject(
        address treasury_,
        uint256 milestoneCount_,
        string calldata name_,
        string calldata description_,
        string calldata additionalFilesUrl_,
        string calldata iconUrl_,
        string calldata metadataUri_,
        uint256 fundingGoal_,
        uint256 fundingDeadline_,
        uint256 milestoneWindow_
    ) external returns (uint256 projectId) {
        if (treasury_ == address(0)) revert BadAddress();
        if (milestoneCount_ == 0) revert BadMilestones();
        if (fundingDeadline_ == 0 && fundingGoal_ > 0) {
            fundingDeadline_ = block.timestamp + DEFAULT_FUNDING_DEADLINE;
        } else if (fundingDeadline_ > block.timestamp + MAX_FUNDING_DEADLINE)
            revert BadDeadline();
        if (milestoneWindow_ == 0) {
            milestoneWindow_ = 60 days;
        } else if (milestoneWindow_ < MIN_MILESTONE_WINDOW) {
            revert MilestoneWindowTooShort();
        } else if (milestoneWindow_ > MAX_MILESTONE_WINDOW) {
            revert MilestoneWindowTooLong();
        }

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
        p.iconUrl = iconUrl_;
        p.milestoneWindow = milestoneWindow_;
        founderProjects[msg.sender].push(projectId);

        emit ProjectCreated(
            projectId,
            msg.sender,
            treasury_,
            milestoneCount_,
            metadataUri_,
            name_,
            description_,
            additionalFilesUrl_,
            iconUrl_
        );
    }

    function approveProject(
        uint256 projectId
    ) external onlyAdmin validProject(projectId) {
        projects[projectId].approved = true;
        emit ProjectApproved(projectId);
    }

    // ---- investment ----

    function invest(
        uint256 projectId,
        uint256 amount,
        bytes calldata
    ) external validProject(projectId) {
        if (amount == 0) revert ZeroAmount();
        Project storage proj = projects[projectId];
        if (!proj.approved) revert ProjectNotApproved();
        if (proj.projectDead) revert ProjectComplete();
        if (proj.releaseRequestedAt != 0) revert ReleasePending();

        if (proj.fundingDeadline != 0 && block.timestamp > proj.fundingDeadline)
            revert DeadlinePassed();

        if (
            proj.fundingDeadline == 0 &&
            proj.currentMilestone >= proj.milestoneCount
        ) revert ProjectComplete();
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

        if (userIndex[msg.sender] == 0) userIndex[msg.sender] = yieldIndex;

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

    // Called by the AMM after a swapUsdcForCommit to auto-register the buyer
    function registerFromAMM(
        uint256 projectId,
        address buyer
    ) external validProject(projectId) {
        if (address(amm) == address(0) || msg.sender != address(amm)) revert NotAMM();
        if (!inUserProjects[buyer][projectId]) {
            _accrue(buyer);
            inUserProjects[buyer][projectId] = true;
            userProjects[buyer].push(projectId);
            emit ProjectRegistered(projectId, buyer);
        }
    }

    // ---- milestone ----

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
        proj.currentMilestone = next;
        emit MilestoneVerified(projectId, next);
    }

    function claimInitialMilestoneRelease(
        uint256 projectId
    ) external onlyProjectFounder(projectId) {
        Project storage proj = projects[projectId];
        if (proj.fundingGoal != 0 && proj.totalRaised < proj.fundingGoal)
            revert FundingGoalNotMet();
        if (proj.currentMilestone != 0 || proj.totalReleased != 0)
            revert MilestoneDone();
        if (
            proj.fundingDeadline != 0 && block.timestamp <= proj.fundingDeadline
        ) revert DeadlineNotPassed();
        _releaseInitialMilestone(projectId, proj);
        _autoSeedAmm(projectId, proj);
    }

    // ---- milestone timeout ----

    function triggerMilestoneTimeout(
        uint256 projectId
    ) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (proj.projectDead) revert ProjectDead();
        if (proj.milestoneDeadline == 0) revert NoMilestone();
        if (block.timestamp <= proj.milestoneDeadline)
            revert MilestoneDeadlineNotPassed();
        if (proj.timeoutActive) revert TimeoutAlreadyOpen();
        if (proj.releaseRequestedAt != 0) revert ReleasePending();
        if (commit.balanceOf(msg.sender, projectId) == 0) revert NotBacker();
        proj.timeoutActive = true;
        proj.timeoutOpenedAt = block.timestamp;
        emit MilestoneTimeoutOpened(projectId, proj.milestoneDeadline);
    }

    function voteTimeout(
        uint256 projectId,
        bool extend
    ) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (!proj.timeoutActive) revert NoTimeoutOpen();
        if (block.timestamp > proj.timeoutOpenedAt + TIMEOUT_VOTE_WINDOW)
            revert TimeoutWindowNotOver();
        if (hasVotedTimeout[projectId][msg.sender])
            revert AlreadyVotedTimeout();
        uint256 stake = commit.balanceOf(msg.sender, projectId);
        if (stake == 0) revert NotBacker();
        hasVotedTimeout[projectId][msg.sender] = true;
        timeoutVotedStake[projectId][msg.sender] = stake;
        timeoutVoters[projectId].push(msg.sender);
        if (extend) {
            timeoutVotesExtend[projectId] += stake;
        } else {
            timeoutVotesRefund[projectId] += stake;
        }
        emit TimeoutVoteCast(projectId, msg.sender, extend, stake);
    }

    function executeTimeoutOutcome(
        uint256 projectId
    ) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (!proj.timeoutActive) revert NoTimeoutOpen();
        if (block.timestamp <= proj.timeoutOpenedAt + TIMEOUT_VOTE_WINDOW)
            revert TimeoutWindowNotOver();

        bool refundWins = timeoutVotesRefund[projectId] >
            timeoutVotesExtend[projectId];

        // reset vote state
        proj.timeoutActive = false;
        proj.timeoutOpenedAt = 0;
        timeoutVotesExtend[projectId] = 0;
        timeoutVotesRefund[projectId] = 0;
        address[] storage voters = timeoutVoters[projectId];
        for (uint256 i = 0; i < voters.length; i++) {
            hasVotedTimeout[projectId][voters[i]] = false;
            timeoutVotedStake[projectId][voters[i]] = 0;
        }
        delete timeoutVoters[projectId];

        if (refundWins) {
            proj.projectDead = true;
            proj.milestoneDeadline = 0;
            emit TimeoutResolved(projectId, false);
        } else {
            // default: extend — reset deadline from now
            proj.milestoneDeadline = block.timestamp + proj.milestoneWindow;
            emit TimeoutResolved(projectId, true);
        }
    }

    function claimTimeoutRefund(
        uint256 projectId
    ) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (!proj.projectDead) revert ProjectDead();
        uint256 userTokens = commit.balanceOf(msg.sender, projectId);
        if (userTokens == 0) revert NotBacker();
        _processRefund(projectId, proj, userTokens);
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

    
    function approveRelease(
        uint256 projectId
    ) external validProject(projectId) {
        uint256 stake = commit.balanceOf(msg.sender, projectId);
        if (stake == 0) revert NotBacker();
        Project storage proj = projects[projectId];
        if (proj.releaseRequestedAt == 0) revert NoRequest();
        if (block.timestamp >= proj.releaseRequestedAt + VETO_WINDOW)
            revert VetoWindowOver();
        if (proj.releaseVetoed) revert AlreadyVetoed();
        if (hasApproved[projectId][msg.sender]) revert AlreadyVoted();
        if (hasVoted[projectId][msg.sender]) revert AlreadyVoted();

        hasApproved[projectId][msg.sender] = true;
        approvedStake[projectId][msg.sender] = stake;
        approveVoters[projectId].push(msg.sender);
        approveVotes[projectId] += stake;

        // Denominator = tokens in investor hands (exclude AMM pool-held tokens)
        uint256 totalSupply = commit.totalSupplyByProject(projectId);
        uint256 ammHeld = address(amm) != address(0)
            ? commit.balanceOf(address(amm), projectId)
            : 0;
        uint256 circulatingSupply = totalSupply > ammHeld
            ? totalSupply - ammHeld
            : totalSupply;
        if (
            !proj.releaseApproved &&
            approveVotes[projectId] * 10_000 >=
            circulatingSupply * APPROVAL_THRESHOLD_BPS
        ) {
            proj.releaseApproved = true;
            emit ReleaseApprovedThresholdMet(projectId);
            emit ReleaseApproved(projectId, msg.sender);
            _executeRelease(projectId, proj);
            return;
        }

        emit ReleaseApproved(projectId, msg.sender);
    }

    function executeRelease(
        uint256 projectId
    ) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (proj.releaseRequestedAt == 0) revert NoRequest();
        if (proj.releaseVetoed) revert VetoActive();
        // Early release allowed if backers approve, otherwise wait for window
        if (
            !proj.releaseApproved &&
            block.timestamp < proj.releaseRequestedAt + VETO_WINDOW
        ) revert VetoWindowNotOver();
        _executeRelease(projectId, proj);
    }

    function releasable(uint256 projectId) public view returns (uint256) {
        Project storage proj = projects[projectId];
        if (proj.founder == address(0)) return 0;
        uint256 unlocked = proj.currentMilestone == proj.milestoneCount
            ? proj.totalRaised
            : (proj.totalRaised * proj.currentMilestone) / proj.milestoneCount;
        uint256 unavailable = proj.totalReleased + proj.totalAmmSeeded;
        if (unlocked <= unavailable) return 0;
        return unlocked - unavailable;
    }

    // ---- veto ----

    function veto(uint256 projectId) external validProject(projectId) {
        uint256 stake = commit.balanceOf(msg.sender, projectId);
        if (stake == 0) revert NotBacker();
        Project storage proj = projects[projectId];
        if (proj.releaseRequestedAt == 0) revert NoRequest();
        if (block.timestamp >= proj.releaseRequestedAt + VETO_WINDOW)
            revert VetoWindowOver();
        if (proj.releaseVetoed) revert AlreadyVetoed();
        if (hasVoted[projectId][msg.sender]) revert AlreadyVoted();
        if (hasApproved[projectId][msg.sender]) revert AlreadyVoted();

        hasVoted[projectId][msg.sender] = true;
        votedStake[projectId][msg.sender] = stake;
        vetoVoters[projectId].push(msg.sender);
        vetoVotes[projectId] += stake;

        // Denominator = tokens in investor hands (exclude AMM pool-held tokens which can't vote)
        uint256 totalSupply = commit.totalSupplyByProject(projectId);
        uint256 ammHeld = address(amm) != address(0)
            ? commit.balanceOf(address(amm), projectId)
            : 0;
        uint256 circulatingSupply = totalSupply > ammHeld
            ? totalSupply - ammHeld
            : totalSupply;
        if (
            vetoVotes[projectId] * 10_000 >=
            circulatingSupply * VETO_THRESHOLD_BPS
        ) {
            proj.releaseVetoed = true;
        }

        emit VetoedEvent(projectId, msg.sender);
    }

    function cancelVeto(uint256 projectId) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (proj.releaseRequestedAt == 0) revert NoRequest();
        if (block.timestamp >= proj.releaseRequestedAt + VETO_WINDOW)
            revert VetoWindowOver();
        if (!hasVoted[projectId][msg.sender]) revert NotVetoed();

        uint256 stake = votedStake[projectId][msg.sender];
        votedStake[projectId][msg.sender] = 0;
        hasVoted[projectId][msg.sender] = false;
        if (vetoVotes[projectId] >= stake) {
            vetoVotes[projectId] -= stake;
        } else {
            vetoVotes[projectId] = 0;
        }

        // Remove from voters array
        address[] storage voters = vetoVoters[projectId];
        for (uint256 i = 0; i < voters.length; i++) {
            if (voters[i] == msg.sender) {
                voters[i] = voters[voters.length - 1];
                voters.pop();
                break;
            }
        }

        emit VetoCancelled(projectId, msg.sender);
    }

    function clearVeto(uint256 projectId) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (msg.sender != proj.treasury) revert NotTreasury();
        if (!proj.releaseVetoed) revert NotVetoed();
        proj.releaseVetoed = false;
        proj.releaseRequestedAt = 0;
        proj.releaseApproved = false;
        _clearVetoVotes(projectId);
        _clearApprovalVotes(projectId);
        activeReleaseCount--;
        emit VetoCleared(projectId, msg.sender);
    }

    function claimVetoRefund(
        uint256 projectId
    ) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (!proj.releaseVetoed) revert NotVetoed();
        if (block.timestamp < proj.releaseRequestedAt + VETO_WINDOW)
            revert VetoWindowNotOver();
        uint256 userTokens = commit.balanceOf(msg.sender, projectId);
        if (userTokens == 0) revert NotBacker();
        _processRefund(projectId, proj, userTokens);
    }

    // ---- AMM ----

    function seedAmmPool(uint256 projectId) external validProject(projectId) {
        Project storage proj = projects[projectId];
        if (!this.ammProjectReady(projectId)) revert FundingGoalNotMet();
        _autoSeedAmm(projectId, proj);
    }

    function ammProjectReady(uint256 projectId) external view returns (bool) {
        if (projectId == 0 || projectId > projectCount) return false;
        Project storage proj = projects[projectId];
        return
            proj.approved &&
            proj.fundingGoal > 0 &&
            proj.totalRaised >= proj.fundingGoal &&
            (block.timestamp > proj.fundingDeadline ||
                proj.currentMilestone > 0);
    }

    // ---- lender / yield ----

    function harvestYield() external {
        if (address(lender) == address(0)) revert NoLender();
        uint256 distributed = totalReleasedGlobal + totalAmmSeededGlobal;
        uint256 lockedPrincipal = distributed >= totalRaised
            ? 0
            : totalRaised - distributed;
        uint256 lenderBal = lender.balance();
        if (lenderBal <= lockedPrincipal) return;
        uint256 yieldAmt = lenderBal - lockedPrincipal;
        lender.withdrawYield(yieldAmt, address(this));
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

    function pendingYield(address user) external view returns (uint256) {
        uint256 pending = claimableYield[user];
        uint256 stake = _totalStake(user);
        uint256 last = userIndex[user] == 0 ? ONE : userIndex[user];
        if (stake > 0 && yieldIndex > last) {
            pending += (stake * (yieldIndex - last)) / ONE;
        }
        return pending;
    }

    // ---- views ----

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

    // ---- internal helpers ----

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

    function _executeRelease(uint256 projectId, Project storage proj) internal {
        uint256 amt = releasable(projectId);
        if (amt == 0) revert NothingToRelease();

        proj.totalReleased += amt;
        totalReleasedGlobal += amt;
        proj.releaseRequestedAt = 0;
        proj.releaseVetoed = false;
        proj.releaseApproved = false;
        activeReleaseCount--;
        _clearVetoVotes(projectId);
        _clearApprovalVotes(projectId);

        if (releaseFeeBps > 0 && revenueRouter != address(0)) {
            uint256 fee = (amt * releaseFeeBps) / 10_000;
            uint256 toTreasury = amt - fee;
            _withdrawAndTransfer(proj.treasury, toTreasury);
            _withdrawAndTransfer(revenueRouter, fee);
            IRevenueRouter(revenueRouter).onRevenue(fee);
        } else {
            _withdrawAndTransfer(proj.treasury, amt);
        }
        // reset milestone deadline for the next milestone
        if (
            proj.currentMilestone < proj.milestoneCount &&
            proj.milestoneWindow > 0
        ) {
            proj.milestoneDeadline = block.timestamp + proj.milestoneWindow;
        } else {
            proj.milestoneDeadline = 0; // last milestone — no more deadlines
        }
        emit FundsReleased(
            projectId,
            proj.currentMilestone,
            amt,
            proj.treasury
        );
    }

    function _releaseInitialMilestone(
        uint256 projectId,
        Project storage proj
    ) internal {
        if (proj.milestoneCount == 0) revert BadMilestones();
        proj.currentMilestone = 1;
        uint256 amt = releasable(projectId);
        if (amt == 0) revert NothingToRelease();
        proj.totalReleased += amt;
        totalReleasedGlobal += amt;
        _withdrawAndTransfer(proj.treasury, amt);
        // start milestone clock if more milestones remain
        if (
            proj.currentMilestone < proj.milestoneCount &&
            proj.milestoneWindow > 0
        ) {
            proj.milestoneDeadline = block.timestamp + proj.milestoneWindow;
        }
        emit MilestoneVerified(projectId, 1);
        emit FundsReleased(projectId, 1, amt, proj.treasury);
    }

    function _autoSeedAmm(uint256 projectId, Project storage proj) internal {
        if (address(amm) == address(0) || ammSeedBps == 0) return;
        if (amm.seeded(projectId)) return;

        uint256 unavailable = proj.totalReleased + proj.totalAmmSeeded;
        if (proj.totalRaised <= unavailable) return;

        uint256 seedAmount = (proj.totalRaised * ammSeedBps) / 10_000;
        uint256 remaining = proj.totalRaised - unavailable;
        if (seedAmount > remaining) seedAmount = remaining;
        if (seedAmount == 0) return;

        proj.totalAmmSeeded += seedAmount;
        totalAmmSeededGlobal += seedAmount;
        _withdrawAndTransfer(address(amm), seedAmount);
        commit.mint(projectId, address(amm), seedAmount);
        amm.seedFromVault(projectId, seedAmount, seedAmount);
        emit AmmSeeded(projectId, seedAmount, seedAmount);
    }

    function _processRefund(
        uint256 projectId,
        Project storage proj,
        uint256 userTokens
    ) internal {
        uint256 totalSupply = commit.totalSupplyByProject(projectId);
        if (totalSupply == 0) revert NothingToRefund();
        uint256 unavailable = proj.totalReleased + proj.totalAmmSeeded;
        if (proj.totalRaised <= unavailable) revert NothingToRefund();
        uint256 refundable = proj.totalRaised - unavailable;
        uint256 ammHeld = address(amm) != address(0)
            ? commit.balanceOf(address(amm), projectId)
            : 0;
        uint256 circulatingSupply = totalSupply > ammHeld
            ? totalSupply - ammHeld
            : totalSupply;
        if (circulatingSupply == 0) revert NothingToRefund();
        uint256 refundAmt = (refundable * userTokens) / circulatingSupply;
        if (refundAmt == 0) revert NothingToRefund();
        _accrue(msg.sender);
        commit.burn(projectId, msg.sender, userTokens);
        proj.totalRaised -= refundAmt;
        totalRaised = totalRaised >= refundAmt ? totalRaised - refundAmt : 0;
        _withdrawAndTransfer(msg.sender, refundAmt);
        emit Refunded(projectId, msg.sender, refundAmt);
    }

    function _clearVetoVotes(uint256 projectId) internal {
        vetoVotes[projectId] = 0;
        address[] storage voters = vetoVoters[projectId];
        for (uint256 i = 0; i < voters.length; i++) {
            hasVoted[projectId][voters[i]] = false;
            votedStake[projectId][voters[i]] = 0;
        }
        delete vetoVoters[projectId];
    }

    function _clearApprovalVotes(uint256 projectId) internal {
        approveVotes[projectId] = 0;
        address[] storage voters = approveVoters[projectId];
        for (uint256 i = 0; i < voters.length; i++) {
            hasApproved[projectId][voters[i]] = false;
            approvedStake[projectId][voters[i]] = 0;
        }
        delete approveVoters[projectId];
    }

    function _withdrawAndTransfer(address to, uint256 amt) internal {
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < amt && address(lender) != address(0)) {
            lender.withdraw(amt - bal, address(this));
        }
        if (!usdc.transfer(to, amt)) revert TransferFailed();
    }
}

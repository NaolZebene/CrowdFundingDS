// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

interface IERC20Swap {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);
}

interface ICommitSwap {
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;
}

interface ICrowdVault {
    function projectCount() external view returns (uint256);
    function ammProjectReady(uint256 projectId) external view returns (bool);
    function registerFromAMM(uint256 projectId, address buyer) external;
}

contract CommitmentAMM is ERC1155Holder {
    IERC20Swap public immutable usdc;
    ICommitSwap public immutable commit;
    ICrowdVault public immutable vault;

    address public admin;
    address public pendingAdmin;

    mapping(uint256 => uint256) public poolUsdc;
    mapping(uint256 => uint256) public poolCommit;
    mapping(uint256 => bool) public seeded;

    uint256 public feeBps = 30;

    error NotAdmin();
    error NotPendingAdmin();
    error AlreadySeeded();
    error NotSeeded();
    error BadProject();
    error BadAddress();
    error EmptyPool();
    error ZeroAmount();
    error Slippage();
    error TransferFailed();
    error FeeTooHigh();
    error NotVault();
    error ProjectNotTradable();

    event Seeded(uint256 indexed projectId, uint256 usdcIn, uint256 commitIn);
    event Swap(
        uint256 indexed projectId,
        address indexed user,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    );
    event FeeSet(uint256 feeBps);
    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != address(vault)) revert NotVault();
        _;
    }

    modifier validProject(uint256 projectId) {
        if (projectId == 0 || projectId > vault.projectCount())
            revert BadProject();
        _;
    }

    modifier projectTradable(uint256 projectId) {
        if (!vault.ammProjectReady(projectId)) revert ProjectNotTradable();
        _;
    }

    modifier notSeeded(uint256 projectId) {
        if (seeded[projectId]) revert AlreadySeeded();
        _;
    }

    modifier seededProject(uint256 projectId) {
        if (!seeded[projectId]) revert NotSeeded();
        _;
    }

    modifier nonEmptySeed(uint256 usdcIn, uint256 commitIn) {
        if (usdcIn == 0 || commitIn == 0) revert EmptyPool();
        _;
    }

    modifier nonZeroAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }

    function isAdmin(address user) external view returns (bool) {
        return user == admin;
    }

    constructor(address usdc_, address commit_, address vault_) {
        usdc = IERC20Swap(usdc_);
        commit = ICommitSwap(commit_);
        vault = ICrowdVault(vault_);
        admin = msg.sender;
    }

    function setFee(uint256 feeBps_) external onlyAdmin {
        if (feeBps_ > 1000) revert FeeTooHigh();
        feeBps = feeBps_;
        emit FeeSet(feeBps_);
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

    function seedFromVault(
        uint256 projectId,
        uint256 usdcIn,
        uint256 commitIn
    )
        external
        onlyVault
        validProject(projectId)
        projectTradable(projectId)
        notSeeded(projectId)
        nonEmptySeed(usdcIn, commitIn)
    {
        poolUsdc[projectId] = usdcIn;

        poolCommit[projectId] = commitIn;

        seeded[projectId] = true;

        emit Seeded(projectId, usdcIn, commitIn);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view returns (uint256) {
        if (reserveIn == 0 || reserveOut == 0) revert EmptyPool();
        uint256 inWithFee = (amountIn * (10_000 - feeBps)) / 10_000;
        return (inWithFee * reserveOut) / (reserveIn + inWithFee);
    }

    function swapCommitForUsdc(
        uint256 projectId,
        uint256 commitIn,
        uint256 minUsdcOut
    )
        external
        nonZeroAmount(commitIn)
        seededProject(projectId)
        projectTradable(projectId)
        returns (uint256 out)
    {
        uint256 rUsdc = poolUsdc[projectId];
        uint256 rCommit = poolCommit[projectId];
        out = getAmountOut(commitIn, rCommit, rUsdc);
        if (out < minUsdcOut) revert Slippage();
        poolCommit[projectId] = rCommit + commitIn;
        poolUsdc[projectId] = rUsdc - out;
        commit.safeTransferFrom(
            msg.sender,
            address(this),
            projectId,
            commitIn,
            ""
        );
        if (!usdc.transfer(msg.sender, out)) revert TransferFailed();
        emit Swap(
            projectId,
            msg.sender,
            address(commit),
            commitIn,
            address(usdc),
            out
        );
    }

    function swapUsdcForCommit(
        uint256 projectId,
        uint256 usdcIn,
        uint256 minCommitOut
    )
        external
        nonZeroAmount(usdcIn)
        seededProject(projectId)
        projectTradable(projectId)
        returns (uint256 out)
    {
        uint256 rUsdc = poolUsdc[projectId];
        uint256 rCommit = poolCommit[projectId];

        out = getAmountOut(usdcIn, rUsdc, rCommit);

        if (out < minCommitOut) revert Slippage();

        poolUsdc[projectId] = rUsdc + usdcIn;
        poolCommit[projectId] = rCommit - out;

        
        if (!usdc.transferFrom(msg.sender, address(this), usdcIn))
            revert TransferFailed();
        commit.safeTransferFrom(address(this), msg.sender, projectId, out, "");
        vault.registerFromAMM(projectId, msg.sender);
        emit Swap(
            projectId,
            msg.sender,
            address(usdc),
            usdcIn,
            address(commit),
            out
        );
    }
}

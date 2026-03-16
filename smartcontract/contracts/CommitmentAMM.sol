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

/// @notice ERC-1155 interface subset needed by the AMM
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
}

/// @title CommitmentAMM — one pool per project, ERC-1155 based
/// @notice Inherits ERC1155Holder so the contract can receive ERC-1155 tokens.
contract CommitmentAMM is ERC1155Holder {
    IERC20Swap public immutable usdc;
    ICommitSwap public immutable commit;
    ICrowdVault public immutable vault;

    address public admin;
    address public pendingAdmin;

    // One pool per projectId
    mapping(uint256 => uint256) public poolUsdc;
    mapping(uint256 => uint256) public poolCommit;
    mapping(uint256 => bool) public seeded;

    uint256 public feeBps = 30; // 0.30%

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
    event LiquidityRemoved(uint256 indexed projectId, uint256 usdcOut, uint256 commitOut);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address usdc_, address commit_, address vault_) {
        usdc = IERC20Swap(usdc_);
        commit = ICommitSwap(commit_);
        vault = ICrowdVault(vault_);
        admin = msg.sender;
    }

    function setFee(uint256 feeBps_) external onlyAdmin {
        if (feeBps_ > 1000) revert FeeTooHigh(); // max 10%
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

    function seed(
        uint256 projectId,
        uint256 usdcIn,
        uint256 commitIn
    ) external onlyAdmin {
        if (projectId == 0 || projectId > vault.projectCount())
            revert BadProject();
        if (seeded[projectId]) revert AlreadySeeded();
        if (usdcIn == 0 || commitIn == 0) revert EmptyPool();
        if (!usdc.transferFrom(msg.sender, address(this), usdcIn))
            revert TransferFailed();
        commit.safeTransferFrom(
            msg.sender,
            address(this),
            projectId,
            commitIn,
            ""
        );
        poolUsdc[projectId] = usdcIn;
        poolCommit[projectId] = commitIn;
        seeded[projectId] = true;
        emit Seeded(projectId, usdcIn, commitIn);
    }

    function removeLiquidity(uint256 projectId) external onlyAdmin {
        if (!seeded[projectId]) revert NotSeeded();
        uint256 usdcOut = poolUsdc[projectId];
        uint256 commitOut = poolCommit[projectId];
        poolUsdc[projectId] = 0;
        poolCommit[projectId] = 0;
        seeded[projectId] = false;
        if (usdcOut > 0) {
            if (!usdc.transfer(admin, usdcOut)) revert TransferFailed();
        }
        if (commitOut > 0) {
            commit.safeTransferFrom(address(this), admin, projectId, commitOut, "");
        }
        emit LiquidityRemoved(projectId, usdcOut, commitOut);
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
    ) external returns (uint256 out) {
        if (commitIn == 0) revert ZeroAmount();
        if (!seeded[projectId]) revert NotSeeded();
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
    ) external returns (uint256 out) {
        if (usdcIn == 0) revert ZeroAmount();
        if (!seeded[projectId]) revert NotSeeded();
        uint256 rUsdc = poolUsdc[projectId];
        uint256 rCommit = poolCommit[projectId];
        out = getAmountOut(usdcIn, rUsdc, rCommit);
        if (out < minCommitOut) revert Slippage();
        poolUsdc[projectId] = rUsdc + usdcIn;
        poolCommit[projectId] = rCommit - out;
        if (!usdc.transferFrom(msg.sender, address(this), usdcIn))
            revert TransferFailed();
        commit.safeTransferFrom(address(this), msg.sender, projectId, out, "");
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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Swap {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract CommitmentAMM {
    IERC20Swap public immutable usdc;
    IERC20Swap public immutable commit;

    uint256 public reserveUsdc;
    uint256 public reserveCommit;

    uint256 public feeBps = 30; // 0.30%

    event Seeded(uint256 usdcIn, uint256 commitIn);
    event Swap(address indexed user, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut);

    constructor(address usdc_, address commit_) {
        usdc = IERC20Swap(usdc_);
        commit = IERC20Swap(commit_);
    }

    function seed(uint256 usdcIn, uint256 commitIn) external {
        require(reserveUsdc == 0 && reserveCommit == 0, "seeded");
        require(usdcIn > 0 && commitIn > 0, "bad");
        require(usdc.transferFrom(msg.sender, address(this), usdcIn), "usdc tf");
        require(commit.transferFrom(msg.sender, address(this), commitIn), "commit tf");
        reserveUsdc = usdcIn;
        reserveCommit = commitIn;
        emit Seeded(usdcIn, commitIn);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public view returns (uint256) {
        require(reserveIn > 0 && reserveOut > 0, "no liq");
        uint256 inWithFee = (amountIn * (10_000 - feeBps)) / 10_000;
        return (inWithFee * reserveOut) / (reserveIn + inWithFee);
    }

    // backer sells COMMIT -> USDC
    function swapCommitForUsdc(uint256 commitIn, uint256 minUsdcOut) external returns (uint256 out) {
        out = getAmountOut(commitIn, reserveCommit, reserveUsdc);
        require(out >= minUsdcOut, "slippage");
        require(commit.transferFrom(msg.sender, address(this), commitIn), "tf");
        require(usdc.transfer(msg.sender, out), "t");
        reserveCommit += commitIn;
        reserveUsdc -= out;
        emit Swap(msg.sender, address(commit), commitIn, address(usdc), out);
    }

    // new user buys COMMIT using USDC
    function swapUsdcForCommit(uint256 usdcIn, uint256 minCommitOut) external returns (uint256 out) {
        out = getAmountOut(usdcIn, reserveUsdc, reserveCommit);
        require(out >= minCommitOut, "slippage");
        require(usdc.transferFrom(msg.sender, address(this), usdcIn), "tf");
        require(commit.transfer(msg.sender, out), "t");
        reserveUsdc += usdcIn;
        reserveCommit -= out;
        emit Swap(msg.sender, address(usdc), usdcIn, address(commit), out);
    }
}
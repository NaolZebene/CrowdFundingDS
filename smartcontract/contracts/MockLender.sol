// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract MockLender {

    IERC20Like public immutable usdc;
    uint256 public constant YIELD_AMOUNT = 10_000; 
    address public admin;
    address public withdrawer;
    uint256 public totalSupplied;    
    uint256 public accruedYield;      


    event Supplied(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event YieldWithdrawn(address indexed to, uint256 amount);
    event YieldAdded(uint256 amount);
    event WithdrawerSet(address indexed withdrawer);
    

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    modifier onlyWithdrawer() {
        require(msg.sender == withdrawer, "not withdrawer");
        _;
    }

    constructor(address usdc_) {
        usdc = IERC20Like(usdc_);
        admin = msg.sender;
    }


    function supply(uint256 amount) external {
        require(amount > 0, "amount=0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "tf");
        totalSupplied += amount;
        emit Supplied(msg.sender, amount);
    }

    function setWithdrawer(address withdrawer_) external onlyAdmin {
        require(withdrawer_ != address(0), "withdrawer=0");
        withdrawer = withdrawer_;
        emit WithdrawerSet(withdrawer_);
    }

    function withdraw(uint256 amount, address to) external onlyWithdrawer {
        require(to != address(0), "to=0");
        require(amount <= totalSupplied + accruedYield, "bal");
        if (amount <= totalSupplied) {
            totalSupplied -= amount;
        } else {
            uint256 fromYield = amount - totalSupplied;
            totalSupplied = 0;
            accruedYield = accruedYield > fromYield ? accruedYield - fromYield : 0;
        }
        require(usdc.balanceOf(address(this)) >= amount, "liq");
        require(usdc.transfer(to, amount), "t");
        emit Withdrawn(to, amount);
    }

    function withdrawYield(uint256 amount, address to) external onlyWithdrawer {
        require(to != address(0), "to=0");
        require(amount <= accruedYield, "yield");
        accruedYield -= amount;
        require(usdc.balanceOf(address(this)) >= amount, "liq");
        require(usdc.transfer(to, amount), "t");
        emit YieldWithdrawn(to, amount);
    }


    function balance() external view returns (uint256) {
        return totalSupplied + accruedYield;
    }

    function yieldBalance() external view returns (uint256) {
        return accruedYield;
    }


    function addYield() external onlyAdmin {
        require(usdc.transferFrom(msg.sender, address(this), YIELD_AMOUNT), "tf");
        accruedYield += YIELD_AMOUNT;
        emit YieldAdded(YIELD_AMOUNT);
    }
}

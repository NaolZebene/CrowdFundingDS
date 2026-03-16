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
    address public admin;

    event Supplied(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event YieldAdded(uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor(address usdc_) {
        usdc = IERC20Like(usdc_);
        admin = msg.sender;
    }

    function supply(uint256 amount) external {
        require(amount > 0, "amount=0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "tf");
        emit Supplied(msg.sender, amount);
    }

    function withdraw(uint256 amount, address to) external {
        require(to != address(0), "to=0");
        require(usdc.balanceOf(address(this)) >= amount, "liq");
        require(usdc.transfer(to, amount), "t");
        emit Withdrawn(to, amount);
    }

    // Demo: admin can inject "yield" by sending extra USDC into the lender
    function addYield(uint256 amount) external onlyAdmin {
        require(amount > 0, "amount=0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "tf");
        emit YieldAdded(amount);
    }

    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Pay {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

contract RevenueRouter {
    IERC20Pay public immutable usdc;
    address public vault;
    address public admin;
    uint256 public totalRevenueReceived;
    uint256 public totalCollected;

    error NotAdmin();
    error NotVault();
    error VaultAlreadySet();
    error ZeroAmount();
    error TransferFailed();
    error NothingToClaim();

    event RevenueReceived(uint256 amount);
    event Collected(address indexed admin, uint256 amount);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    constructor(address usdc_) {
        usdc = IERC20Pay(usdc_);
        admin = msg.sender;
    }

    function setVault(address vault_) external onlyAdmin {
        if (vault != address(0)) revert VaultAlreadySet();
        vault = vault_;
    }

    function onRevenue(uint256 amount) external onlyVault {
        if (amount == 0) revert ZeroAmount();
        if (usdc.balanceOf(address(this)) < amount) revert TransferFailed();
        totalRevenueReceived += amount;
        emit RevenueReceived(amount);
    }

    function collect() external onlyAdmin {
        uint256 toPay = usdc.balanceOf(address(this));
        if (toPay == 0) revert NothingToClaim();
        totalCollected += toPay;
        if (!usdc.transfer(admin, toPay)) revert TransferFailed();
        emit Collected(admin, toPay);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Pay {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract RevenueRouter {
    IERC20Pay public immutable usdc;
    address public immutable treasury;
    address public admin;

    uint256 public backersBps;

    mapping(address => uint256) public weight;
    uint256 public totalWeight;

    uint256 public totalBackersAccrued;
    mapping(address => uint256) public claimed;

    error NotAdmin();
    error BadBps();
    error LengthMismatch();
    error ZeroAmount();
    error TransferFailed();
    error NoWeight();
    error NothingToClaim();

    event RevenueReceived(uint256 amount, uint256 toBackers, uint256 toTreasury);
    event WeightsSet(uint256 totalWeight);
    event Claimed(address indexed user, uint256 amount);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address usdc_, address treasury_, uint256 backersBps_) {
        if (backersBps_ > 10_000) revert BadBps();
        usdc = IERC20Pay(usdc_);
        treasury = treasury_;
        backersBps = backersBps_;
        admin = msg.sender;
    }

    function setWeights(address[] calldata users, uint256[] calldata w) external onlyAdmin {
        if (users.length != w.length) revert LengthMismatch();

        // remove old weights from total first
        for (uint256 i = 0; i < users.length; i++) {
            totalWeight -= weight[users[i]];
            weight[users[i]] = w[i];
            totalWeight += w[i];
        }

        emit WeightsSet(totalWeight);
    }

    function onRevenue(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        uint256 toBackers = (amount * backersBps) / 10_000;
        uint256 toTreasury = amount - toBackers;

        if (!usdc.transfer(treasury, toTreasury)) revert TransferFailed();
        totalBackersAccrued += toBackers;

        emit RevenueReceived(amount, toBackers, toTreasury);
    }

    function claim() external {
        uint256 w = weight[msg.sender];
        if (w == 0) revert NoWeight();
        if (totalWeight == 0) revert NoWeight();

        uint256 entitled = (totalBackersAccrued * w) / totalWeight;
        uint256 toPay = entitled - claimed[msg.sender];
        if (toPay == 0) revert NothingToClaim();

        claimed[msg.sender] = entitled;
        if (!usdc.transfer(msg.sender, toPay)) revert TransferFailed();

        emit Claimed(msg.sender, toPay);
    }
}

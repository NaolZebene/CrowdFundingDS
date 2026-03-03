// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Pay {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract RevenueRouter {
    IERC20Pay public immutable usdc;
    address public immutable treasury;

    uint256 public backersBps; // e.g. 1000 = 10%

    mapping(address => uint256) public weight; // backer weights (snapshot)
    uint256 public totalWeight;

    uint256 public totalBackersAccrued;
    mapping(address => uint256) public claimed;

    event RevenueReceived(uint256 amount, uint256 toBackers, uint256 toTreasury);
    event WeightsSet(uint256 totalWeight);
    event Claimed(address indexed user, uint256 amount);

    constructor(address usdc_, address treasury_, uint256 backersBps_) {
        require(backersBps_ <= 10_000, "bps");
        usdc = IERC20Pay(usdc_);
        treasury = treasury_;
        backersBps = backersBps_;
    }

    function setWeights(address[] calldata users, uint256[] calldata w) external {
        require(users.length == w.length, "len");
        uint256 newTotal = 0;
        for (uint256 i = 0; i < users.length; i++) {
            weight[users[i]] = w[i];
            newTotal += w[i];
        }
        totalWeight = newTotal;
        emit WeightsSet(newTotal);
    }

    function onRevenue(uint256 amount) external {
        require(amount > 0, "amount=0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "tf");

        uint256 toBackers = (amount * backersBps) / 10_000;
        uint256 toTreasury = amount - toBackers;

        require(usdc.transfer(treasury, toTreasury), "treasury");
        totalBackersAccrued += toBackers;

        emit RevenueReceived(amount, toBackers, toTreasury);
    }

    function claim() external {
        uint256 w = weight[msg.sender];
        require(w > 0, "no weight");
        require(totalWeight > 0, "no total");

        uint256 entitled = (totalBackersAccrued * w) / totalWeight;
        uint256 toPay = entitled - claimed[msg.sender];
        require(toPay > 0, "nothing");

        claimed[msg.sender] = entitled;
        require(usdc.transfer(msg.sender, toPay), "transfer");

        emit Claimed(msg.sender, toPay);
    }
}
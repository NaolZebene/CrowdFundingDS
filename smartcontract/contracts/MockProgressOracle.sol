// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockProgressOracle {
    address public admin;
    // projectId => milestone => ok
    mapping(uint256 => mapping(uint256 => bool)) public milestoneOk;

    event MilestoneSet(uint256 indexed projectId, uint256 indexed milestone, bool ok);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function setMilestoneOk(uint256 projectId, uint256 milestone, bool ok) external onlyAdmin {
        milestoneOk[projectId][milestone] = ok;
        emit MilestoneSet(projectId, milestone, ok);
    }
}

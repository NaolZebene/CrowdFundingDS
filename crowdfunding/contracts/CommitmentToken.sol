// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/// @title CommitmentToken — ERC-1155 semi-fungible token
/// @notice Each projectId is a distinct token ID; balances are fungible within a project.
contract CommitmentToken is ERC1155 {
    string public name;
    string public symbol;
    uint8 public decimals = 6;
    address public minter;

    mapping(uint256 => uint256) public totalSupplyByProject;

    event Mint(uint256 indexed projectId, address indexed to, uint256 value);
    event MinterChanged(address indexed oldMinter, address indexed newMinter);

    modifier onlyMinter() {
        require(msg.sender == minter, "not minter");
        _;
    }

    constructor(
        address minter_,
        string memory name_,
        string memory symbol_
    ) ERC1155("") {
        require(minter_ != address(0), "minter cannot be zero address");
        require(bytes(name_).length > 0, "name cannot be empty");
        require(bytes(symbol_).length > 0, "symbol cannot be empty");
        minter = minter_;
        name = name_;
        symbol = symbol_;
    }

    function setMinter(address newMinter) external onlyMinter {
        require(newMinter != address(0), "minter cannot be zero address");
        emit MinterChanged(minter, newMinter);
        minter = newMinter;
    }

    /// @notice Mint `amount` of project-`projectId` tokens to `to`. Only callable by minter (CrowdVault).
    function mint(
        uint256 projectId,
        address to,
        uint256 amount
    ) external onlyMinter {
        totalSupplyByProject[projectId] += amount;
        _mint(to, projectId, amount, "");
        emit Mint(projectId, to, amount);
    }
}

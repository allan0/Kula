// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RotaryGroup is ReentrancyGuard {
    struct Group {
        string name;
        uint256 contributionAmount;
        uint256 interval;
        uint256 lastRotationTime;
        uint256 currentRound;
        address[] members;
        bool isActive;
    }

    IERC20 public usdc;
    mapping(uint256 => Group) public groups;
    uint256 public groupCount;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function createGroup(string memory _name, uint256 _amount, uint256 _interval) external {
        groupCount++;
        Group storage g = groups[groupCount];
        g.name = _name;
        g.contributionAmount = _amount;
        g.interval = _interval;
        g.isActive = true;
        g.lastRotationTime = block.timestamp;
    }

    function joinGroup(uint256 _groupId) external {
        require(groups[_groupId].isActive, "Group not active");
        groups[_groupId].members.push(msg.sender);
    }

    function getMembers(uint256 _groupId) external view returns (address[] memory) {
        return groups[_groupId].members;
    }
}

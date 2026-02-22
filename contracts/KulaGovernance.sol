// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract KulaGovernance {
    struct Proposal {
        string description;
        uint256 amount;
        address recipient;
        uint256 votesFor;
        bool executed;
        string documentHash; // IPFS Link to Deed/Car Logbook
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    // Members vote to approve a purchase or bill
    function createProposal(string memory _desc, uint256 _amt, address _to, string memory _doc) external {
        proposalCount++;
        proposals[proposalCount] = Proposal(_desc, _amt, _to, 0, false, _doc);
    }
}

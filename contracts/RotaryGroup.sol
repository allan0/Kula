// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RotaryGroup {
    struct MemberReputation {
        uint256 score; // 0 to 100
        uint256 consistentPayments;
        uint256 totalDelays;
        uint256 referralCount;
    }

    struct JoinRequest {
        address applicant;
        uint256 votesFor;
        uint256 votesAgainst;
        bool processed;
    }

    mapping(address => MemberReputation) public reputations;
    mapping(uint256 => mapping(address => JoinRequest)) public joinRequests; // groupId => user => request
    
    // Initialize reputation at 50 for new users
    function initializeReputation(address _user) internal {
        if(reputations[_user].score == 0) {
            reputations[_user].score = 50;
        }
    }

    // Members vote to admit a new individual
    function voteOnApplicant(uint256 _groupId, address _applicant, bool _support) external {
        require(isMember(_groupId, msg.sender), "Only members vote");
        JoinRequest storage req = joinRequests[_groupId][_applicant];
        
        if(_support) req.votesFor++;
        else req.votesAgainst++;

        // Auto-admit if 70% of group (e.g., 3 votes for demo) approve
        if(req.votesFor >= 3 && !req.processed) {
            groups[_groupId].members.push(_applicant);
            req.processed = true;
        }
    }

    // Logic called by the contribution function to update score
    function updateReputation(address _user, bool _onTime) internal {
        if(_onTime) {
            reputations[_user].score = reputations[_user].score + 5 > 100 ? 100 : reputations[_user].score + 5;
            reputations[_user].consistentPayments++;
        } else {
            reputations[_user].score = reputations[_user].score < 10 ? 0 : reputations[_user].score - 10;
            reputations[_user].totalDelays++;
        }
    }
}

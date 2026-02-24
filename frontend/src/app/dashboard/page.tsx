// 1. Add these imports at the top
import { useWriteContract, useAccount } from 'wagmi';

// ... inside the Dashboard function ...
const { writeContract } = useWriteContract();
const { address } = useAccount();

const handleVote = (proposalId: number) => {
  if (!address) return alert("Please connect your vault key first.");

  writeContract({
    abi: [
      {
        "inputs": [{ "internalType": "uint256", "name": "_proposalId", "type": "uint256" }],
        "name": "voteOnProposal",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    address: '0xFfAB10611EF65d877Db508Fe9e7111Bb1C759Af8', // Your KULA Contract
    functionName: 'voteOnProposal',
    args: [BigInt(proposalId)],
  });
};

// 2. Update the "APPROVE" button in the "votes" tab:
<button 
  onClick={() => handleVote(42)} 
  className="w-full md:w-auto px-10 py-4 bg-gold text-earth-dark rounded-2xl font-black text-sm tracking-widest shadow-[0_10px_20px_rgba(212,175,55,0.2)] hover:scale-105 transition-transform"
>
  APPROVE
</button>

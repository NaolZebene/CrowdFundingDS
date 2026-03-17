export const AMM_ABI = [
  { name: "poolUsdc",           type: "function", stateMutability: "view",        inputs: [{ name: "projectId", type: "uint256" }],                                                                          outputs: [{ type: "uint256" }] },
  { name: "poolCommit",         type: "function", stateMutability: "view",        inputs: [{ name: "projectId", type: "uint256" }],                                                                          outputs: [{ type: "uint256" }] },
  { name: "seeded",             type: "function", stateMutability: "view",        inputs: [{ name: "projectId", type: "uint256" }],                                                                          outputs: [{ type: "bool"    }] },
  { name: "feeBps",             type: "function", stateMutability: "view",        inputs: [],                                                                                                                 outputs: [{ type: "uint256" }] },
  { name: "swapUsdcForCommit",  type: "function", stateMutability: "nonpayable",  inputs: [{ name: "projectId", type: "uint256" }, { name: "usdcIn",    type: "uint256" }, { name: "minCommitOut", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "swapCommitForUsdc",  type: "function", stateMutability: "nonpayable",  inputs: [{ name: "projectId", type: "uint256" }, { name: "commitIn",  type: "uint256" }, { name: "minUsdcOut",   type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

export const ERC20_ABI = [
  { name: "balanceOf",  type: "function", stateMutability: "view",       inputs: [{ name: "account", type: "address" }],                                              outputs: [{ type: "uint256" }] },
  { name: "allowance",  type: "function", stateMutability: "view",       inputs: [{ name: "owner",   type: "address" }, { name: "spender", type: "address" }],        outputs: [{ type: "uint256" }] },
  { name: "approve",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount",  type: "uint256" }],        outputs: [{ type: "bool"    }] },
] as const;

export const ERC1155_ABI = [
  { name: "balanceOf",        type: "function", stateMutability: "view",       inputs: [{ name: "account",   type: "address" }, { name: "id",       type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "isApprovedForAll", type: "function", stateMutability: "view",       inputs: [{ name: "account",   type: "address" }, { name: "operator", type: "address" }], outputs: [{ type: "bool"    }] },
  { name: "setApprovalForAll",type: "function", stateMutability: "nonpayable", inputs: [{ name: "operator",  type: "address" }, { name: "approved", type: "bool"    }], outputs: [] },
] as const;

export const VAULT_ABI = [
  { name: "projectCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalRaised",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    name: "projects", type: "function", stateMutability: "view",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [
      { name: "founder",            type: "address"  },
      { name: "treasury",           type: "address"  },
      { name: "milestoneCount",     type: "uint256"  },
      { name: "totalRaised",        type: "uint256"  },
      { name: "totalReleased",      type: "uint256"  },
      { name: "currentMilestone",   type: "uint256"  },
      { name: "releaseRequestedAt", type: "uint256"  },
      { name: "releaseVetoed",      type: "bool"     },
      { name: "metadataUri",        type: "string"   },
      { name: "fundingGoal",        type: "uint256"  },
      { name: "fundingDeadline",    type: "uint256"  },
      { name: "approved",           type: "bool"     },
    ],
  },
] as const;

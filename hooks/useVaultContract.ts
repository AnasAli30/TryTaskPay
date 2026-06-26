
export function useVaultContract() {
    return {
        userVaultBalance: 0,
        totalVaultBalance: 0,
        badgeTier: 0,
        usdcBalance: 0,
        usdcAllowance: 0,
        depositBatch: async (amount: number, fid: number) => {
            console.log('Mock depositBatch', amount, fid);
            await new Promise(resolve => setTimeout(resolve, 1000));
        },
        withdraw: async (amount: number) => {
            console.log('Mock withdraw', amount);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        },
        refetch: () => console.log('Mock refetch'),
    }
}

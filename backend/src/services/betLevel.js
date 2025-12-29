import { CONFIG } from '../config/constants.js';
import { supabase } from '../config/database.js';

/**
 * Calculate optimal bet distribution using Dynamic Programming
 * Minimizes the total number of bets while maximizing fund usage
 * @param {number} totalFunds - Total funds available
 * @param {Array} betLevels - Available bet levels (from CONFIG.BET_LEVELS)
 * @returns {object} Optimal bet distribution
 */
function calculateOptimalBets(totalFunds, betLevels) {
  // DP table: dp[amount] = { bets, lastBet, prevAmount }
  const dp = Array(totalFunds + 1).fill(null);
  dp[0] = { bets: 0 };

  // Fill DP table
  for (let amount = 1; amount <= totalFunds; amount++) {
    for (const level of betLevels) {
      if (level.cost <= amount && dp[amount - level.cost] !== null) {
        const newBets = dp[amount - level.cost].bets + 1;
        if (dp[amount] === null || newBets < dp[amount].bets) {
          dp[amount] = {
            bets: newBets,
            lastBet: level,
            prevAmount: amount - level.cost
          };
        }
      }
    }
  }

  // Find best achievable amount
  // Priority: 1) Maximize funds used, 2) Minimize bet count
  let bestAmount = 0;
  let bestBets = Infinity;

  // Try all amounts from highest to lowest
  for (let amount = totalFunds; amount > 0; amount--) {
    if (dp[amount] && dp[amount].bets > 0) {
      // Found a valid solution for this amount
      // Use it if: we haven't found anything yet, OR this uses more funds, OR same funds but fewer bets
      if (bestAmount === 0 ||
          amount > bestAmount ||
          (amount === bestAmount && dp[amount].bets < bestBets)) {
        bestAmount = amount;
        bestBets = dp[amount].bets;

        // If we found exact match, no need to continue
        if (amount === totalFunds) {
          break;
        }
      }
    }
  }

  // Backtrack to reconstruct solution
  const distribution = {};
  let current = bestAmount;
  while (current > 0 && dp[current]) {
    const level = dp[current].lastBet;
    const key = level.numbers;
    distribution[key] = distribution[key] || { numbers: level.numbers, cost: level.cost, count: 0 };
    distribution[key].count++;
    current = dp[current].prevAmount;
  }

  return {
    betDistribution: Object.values(distribution).sort((a, b) => b.numbers - a.numbers),
    totalBets: bestBets,
    totalCost: bestAmount,
    remainingFunds: totalFunds - bestAmount
  };
}

/**
 * Calculate bet level based on total funds
 * @param {number} totalFunds - Total confirmed funds
 * @returns {object} Bet level information
 */
export function calculateBetLevel(totalFunds) {
  if (totalFunds < 6) {
    return {
      betLevel: 0,
      error: 'Fundos insuficientes para aposta mínima (R$ 6,00)',
      totalFunds: totalFunds,
      breakdown: {
        message: `Arrecadado: R$ ${totalFunds.toFixed(2)}. Necessário: R$ 6,00 mínimo`
      }
    };
  }

  const optimal = calculateOptimalBets(totalFunds, CONFIG.BET_LEVELS);

  // Handle case with no bets (shouldn't happen if totalFunds >= 6)
  if (!optimal.betDistribution || optimal.betDistribution.length === 0) {
    return {
      betLevel: 0,
      error: 'Erro ao calcular distribuição de apostas',
      totalFunds: totalFunds
    };
  }

  // Format for backward compatibility
  const largestBet = optimal.betDistribution[0]; // já ordenado desc
  const otherBets = optimal.betDistribution.slice(1);

  return {
    betLevel: largestBet.numbers,
    betCost: largestBet.cost * largestBet.count,
    totalFunds: totalFunds,
    remainingFunds: optimal.remainingFunds,
    betDistribution: optimal.betDistribution,
    totalBets: optimal.totalBets,
    surplusBets: otherBets.reduce((sum, b) => sum + b.count, 0),
    surplusFunds: totalFunds - largestBet.cost * largestBet.count,
    breakdown: {
      mainBet: `${largestBet.count} ${largestBet.count === 1 ? 'aposta' : 'apostas'} de ${largestBet.numbers} números (R$ ${(largestBet.cost * largestBet.count).toFixed(2)})`,
      surplus: otherBets.length > 0
        ? otherBets.map(b => `${b.count} ${b.count === 1 ? 'aposta' : 'apostas'} de ${b.numbers} números (R$ ${(b.cost * b.count).toFixed(2)})`).join(', ')
        : 'Nenhuma aposta adicional',
      remaining: `R$ ${optimal.remainingFunds.toFixed(2)} não utilizado${optimal.remainingFunds > 0 ? ' (insuficiente para aposta adicional)' : ''}`
    }
  };
}

/**
 * Get total funds and bet level for current bolão
 * @param {string} bolaoId - Bolão ID
 * @returns {object} Financial summary
 */
export async function getBolaoFinancials(bolaoId) {
  try {
    // Get bolão info
    const { data: bolao, error: bolaoError } = await supabase
      .from('bolao')
      .select('quota_value, status')
      .eq('id', bolaoId)
      .single();

    if (bolaoError) throw bolaoError;

    // Get confirmed participations with quota quantities
    const { data: participations, error: partError } = await supabase
      .from('participations')
      .select('id, quota_quantity')
      .eq('bolao_id', bolaoId)
      .eq('payment_status', CONFIG.PAYMENT_STATUS.CONFIRMED);

    if (partError) throw partError;

    const confirmedCount = participations ? participations.length : 0;
    const totalQuotas = participations
      ? participations.reduce((sum, p) => sum + (p.quota_quantity || 1), 0)
      : 0;
    const quotaValue = parseFloat(bolao.quota_value);
    const totalFunds = totalQuotas * quotaValue;

    // Calculate bet level
    const betInfo = calculateBetLevel(totalFunds);

    return {
      quotaValue,
      confirmedCount,
      totalFunds,
      ...betInfo,
      status: bolao.status
    };
  } catch (error) {
    console.error('Error getting bolão financials:', error);
    throw error;
  }
}

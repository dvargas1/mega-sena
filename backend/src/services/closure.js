import { supabase } from '../config/database.js';
import { CONFIG } from '../config/constants.js';
import { getBolaoFinancials } from './betLevel.js';
import { generateClosureHash } from '../utils/hash.js';
import { getScores } from './scoring.js';
import { generateWeightedRandomNumbers } from '../utils/weightedRandom.js';
import { selectBestNumbers, validateSelection } from '../utils/numberSelection.js';

/**
 * Consolidate final numbers based on user votes and scores
 * @param {string} bolaoId - Bolão ID
 * @param {number} targetCount - How many numbers to select
 * @returns {Array<number>} Selected numbers (sorted)
 */
export async function consolidateFinalNumbers(bolaoId, targetCount) {
  try {
    // Get all selections from confirmed participants
    const { data: selections, error: selError } = await supabase
      .from('number_selections')
      .select(`
        number,
        participations!inner(payment_status)
      `)
      .eq('participations.bolao_id', bolaoId)
      .eq('participations.payment_status', CONFIG.PAYMENT_STATUS.CONFIRMED);

    if (selError) throw selError;

    // Count user votes for each number
    const userVotes = {};
    if (selections) {
      selections.forEach(sel => {
        userVotes[sel.number] = (userVotes[sel.number] || 0) + 1;
      });
    }

    // Get scores for tiebreaking
    const { data: scores, error: scoreError } = await supabase
      .from('number_scores')
      .select('number, final_score')
      .eq('bolao_id', bolaoId);

    if (scoreError) throw scoreError;

    const scoreMap = {};
    scores.forEach(s => {
      scoreMap[s.number] = s.final_score;
    });

    // Create ranked list
    const ranked = [];
    for (let num = 1; num <= 60; num++) {
      ranked.push({
        number: num,
        votes: userVotes[num] || 0,
        score: scoreMap[num] || 0
      });
    }

    // Sort: votes DESC, then score DESC
    ranked.sort((a, b) => {
      if (b.votes !== a.votes) {
        return b.votes - a.votes; // More votes first
      }
      return b.score - a.score; // Higher score first (tiebreaker)
    });

    // Get larger pool of candidates (4x the target for more options)
    const poolSize = Math.min(targetCount * 4, 60);
    const candidatePool = ranked.slice(0, poolSize);

    console.log(`🎲 Democratic consolidation: selecting ${targetCount} from top ${candidatePool.length} candidates`);

    // Use intelligent selector with high strictness
    const selected = selectBestNumbers(candidatePool, targetCount, {
      strictness: 'high',
      minQualityScore: 70
    });

    // Validate result
    const validation = validateSelection(selected);
    console.log(`📊 Final selection quality: ${validation.quality}/100`);
    if (validation.issues.length > 0) {
      validation.issues.forEach(issue => {
        console.log(`   ⚠️  ${issue.severity.toUpperCase()}: ${issue.message}`);
      });
    }

    return selected;
  } catch (error) {
    console.error('Error consolidating final numbers:', error);
    throw error;
  }
}

/**
 * Close the bolão and generate final bets with cryptographic hash
 * @param {string} bolaoId - Bolão ID
 * @param {string} adminUserId - Admin user ID performing the closure
 * @returns {object} Closure result with hash and final bets
 */
export async function closeBolao(bolaoId, adminUserId) {
  try {
    console.log('🔒 Closing bolão:', bolaoId);

    // 1. Verify bolão is open
    const { data: bolao, error: bolaoError } = await supabase
      .from('bolao')
      .select('*')
      .eq('id', bolaoId)
      .eq('status', CONFIG.BOLAO_STATUS.OPEN)
      .single();

    if (bolaoError || !bolao) {
      throw new Error('Bolão not found or already closed');
    }

    // 2. Get financial summary
    const financials = await getBolaoFinancials(bolaoId);

    if (financials.betLevel === 0) {
      throw new Error(financials.error || 'Insufficient funds');
    }

    console.log('💰 Total funds:', financials.totalFunds);
    console.log('🎯 Optimized bet distribution:');
    financials.betDistribution.forEach(bet => {
      console.log(`   - ${bet.count}× ${bet.numbers} números (R$ ${bet.cost} cada)`);
    });
    console.log('🎲 Total bets:', financials.totalBets);
    console.log('💸 Remaining funds:', financials.remainingFunds);

    // 3. Get all confirmed participants with their selections
    // Note: Using !participations_user_id_fkey to specify the user relationship
    const { data: participants, error: partError } = await supabase
      .from('participations')
      .select(`
        id,
        users!participations_user_id_fkey(id, name),
        number_selections(number)
      `)
      .eq('bolao_id', bolaoId)
      .eq('payment_status', CONFIG.PAYMENT_STATUS.CONFIRMED);

    if (partError) throw partError;

    // Auto-generate numbers for participants who didn't select
    const scores = await getScores(bolaoId, false);
    for (const participant of participants) {
      if (!participant.number_selections || participant.number_selections.length === 0) {
        console.log(`🎲 Auto-generating numbers for ${participant.users.name}`);

        // Generate weighted random numbers
        const generated = generateWeightedRandomNumbers(
          scores.map(s => ({ number: s.number, score: s.final_score })),
          6
        );

        // Insert generated selections
        const selections = generated.map(num => ({
          participation_id: participant.id,
          number: num
        }));

        const { error: insertError } = await supabase
          .from('number_selections')
          .insert(selections);

        if (insertError) {
          console.error(`Error auto-generating for ${participant.users.name}:`, insertError);
        } else {
          // Update the participant object with generated numbers
          participant.number_selections = selections.map(s => ({ number: s.number }));
        }
      }
    }

    // Transform participants data
    const participantsData = participants.map(p => ({
      userId: p.users.id,
      name: p.users.name,
      selectedNumbers: p.number_selections.map(ns => ns.number).sort((a, b) => a - b)
    }));

    // 4. Get all number selections with user names for tooltips
    const { data: allSelections } = await supabase
      .from('number_selections')
      .select(`
        number,
        participations!inner(
          users!participations_user_id_fkey(name)
        )
      `)
      .eq('participations.bolao_id', bolaoId)
      .eq('participations.payment_status', CONFIG.PAYMENT_STATUS.CONFIRMED);

    // Build a map of number -> list of users who selected it
    const numberToUsers = {};
    if (allSelections) {
      allSelections.forEach(sel => {
        const num = sel.number;
        const userName = sel.participations.users.name;
        if (!numberToUsers[num]) {
          numberToUsers[num] = [];
        }
        numberToUsers[num].push(userName);
      });
    }

    // 5. Generate final bets based on optimized distribution
    const finalBetsArray = [];
    const usedNumbers = new Set(); // Track used numbers across all bets
    let isFirstLargeBet = true; // Track if we've generated the first large bet

    for (const betInfo of financials.betDistribution) {
      console.log(`\n🎲 Generating ${betInfo.count} bet(s) of ${betInfo.numbers} numbers...`);

      for (let i = 0; i < betInfo.count; i++) {
        let numbers;

        if (betInfo.numbers >= 7) {
          // Large bets (7-9 numbers)
          if (isFirstLargeBet && betInfo.numbers === financials.betLevel) {
            // First large bet: use democratic consolidation (votes + scores)
            numbers = await consolidateFinalNumbers(bolaoId, betInfo.numbers);
            console.log(`   Bet ${i + 1}/${betInfo.count} (democratic): ${numbers.join(', ')}`);
            isFirstLargeBet = false;
          } else {
            // Subsequent large bets: use score-based selection with unused numbers
            let availableNumbers = [];
            for (let num = 1; num <= 60; num++) {
              if (!usedNumbers.has(num)) {
                availableNumbers.push(num);
              }
            }

            // If not enough unused numbers, reset pool
            if (availableNumbers.length < betInfo.numbers) {
              console.log(`   ⚠️  Only ${availableNumbers.length} unused numbers. Resetting pool.`);
              usedNumbers.clear();
              availableNumbers = Array.from({ length: 60 }, (_, i) => i + 1);
            }

            // Get larger pool (4x the target for better selection)
            const poolSize = Math.min(betInfo.numbers * 4, availableNumbers.length);

            const { data: scores } = await supabase
              .from('number_scores')
              .select('number, final_score')
              .eq('bolao_id', bolaoId)
              .in('number', availableNumbers)
              .order('final_score', { ascending: false })
              .limit(poolSize);

            if (scores && scores.length >= betInfo.numbers) {
              // Use intelligent selector with high strictness
              const candidates = scores.map(s => ({
                number: s.number,
                score: s.final_score
              }));

              numbers = selectBestNumbers(candidates, betInfo.numbers, {
                strictness: 'high',
                minQualityScore: 65
              });

              console.log(`   Bet ${i + 1}/${betInfo.count} (smart score-based): ${numbers.join(', ')}`);
            } else {
              // Fallback to weighted random
              const scoresData = await getScores(bolaoId, false);
              numbers = generateWeightedRandomNumbers(
                scoresData.map(s => ({ number: s.number, score: s.final_score })),
                betInfo.numbers
              );
              console.log(`   Bet ${i + 1}/${betInfo.count} (fallback): ${numbers.join(', ')}`);
            }
          }
        } else {
          // Small bets (6 numbers): use score-based selection
          let availableNumbers = [];
          for (let num = 1; num <= 60; num++) {
            if (!usedNumbers.has(num)) {
              availableNumbers.push(num);
            }
          }

          if (availableNumbers.length < 6) {
            usedNumbers.clear();
            availableNumbers = Array.from({ length: 60 }, (_, i) => i + 1);
          }

          // Get larger pool (24 números = 4x)
          const poolSize = Math.min(24, availableNumbers.length);

          const { data: scores } = await supabase
            .from('number_scores')
            .select('number, final_score')
            .eq('bolao_id', bolaoId)
            .in('number', availableNumbers)
            .order('final_score', { ascending: false })
            .limit(poolSize);

          if (scores && scores.length >= 6) {
            // Use intelligent selector with high strictness
            const candidates = scores.map(s => ({
              number: s.number,
              score: s.final_score
            }));

            numbers = selectBestNumbers(candidates, 6, {
              strictness: 'high',
              minQualityScore: 65
            });

            console.log(`   Bet ${i + 1}/${betInfo.count} (smart): ${numbers.join(', ')}`);
          } else {
            // Fallback to weighted random
            const scoresData = await getScores(bolaoId, false);
            numbers = generateWeightedRandomNumbers(
              scoresData.map(s => ({ number: s.number, score: s.final_score })),
              6
            );
            console.log(`   Bet ${i + 1}/${betInfo.count} (fallback): ${numbers.join(', ')}`);
          }
        }

        // Add bet to final array
        finalBetsArray.push({
          type: `${betInfo.numbers} números`,
          numbers: numbers,
          cost: betInfo.cost
        });

        // Validate and log quality
        const betValidation = validateSelection(numbers);
        console.log(`   📊 Quality: ${betValidation.quality}/100`);
        if (betValidation.issues.length > 0) {
          betValidation.issues.forEach(issue => {
            const emoji = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
            console.log(`      ${emoji} ${issue.message}`);
          });
        }

        // Mark numbers as used
        numbers.forEach(n => usedNumbers.add(n));
      }
    }

    console.log(`\n✅ Generated ${finalBetsArray.length} total bets (optimized from ${financials.totalBets})`);

    // Aggregate quality analysis
    console.log('\n📊 QUALITY ANALYSIS:');
    const qualityScores = finalBetsArray.map(bet => validateSelection(bet.numbers).quality);
    const avgQuality = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
    const highQualityBets = qualityScores.filter(q => q >= 80).length;
    const mediumQualityBets = qualityScores.filter(q => q >= 60 && q < 80).length;
    const lowQualityBets = qualityScores.filter(q => q < 60).length;

    console.log(`   Average quality: ${Math.round(avgQuality)}/100`);
    console.log(`   High quality bets (≥80): ${highQualityBets}/${finalBetsArray.length}`);
    console.log(`   Medium quality bets (60-79): ${mediumQualityBets}/${finalBetsArray.length}`);
    console.log(`   Low quality bets (<60): ${lowQualityBets}/${finalBetsArray.length}`);

    // 6. Create closure data
    const closureData = {
      bolaoId: bolaoId,
      bolaoName: bolao.name,
      closedAt: new Date().toISOString(),
      closedBy: adminUserId,
      totalFunds: financials.totalFunds,
      quotaValue: financials.quotaValue,
      participantCount: participantsData.length,
      participants: participantsData,
      numberToUsers: numberToUsers, // Map of number -> array of user names
      financials: {
        betLevel: financials.betLevel,
        betCost: financials.betCost,
        surplusBets: financials.surplusBets,
        remainingFunds: financials.remainingFunds,
        betDistribution: financials.betDistribution,
        totalBets: financials.totalBets
      },
      finalBets: finalBetsArray
    };

    // 7. Generate SHA-256 hash
    const hash = generateClosureHash(closureData);

    console.log('🔐 Generated hash:', hash);

    // 8. Update bolão status
    const { error: updateError } = await supabase
      .from('bolao')
      .update({
        status: CONFIG.BOLAO_STATUS.CLOSED,
        closure_hash: hash,
        closure_data: closureData,
        closed_at: closureData.closedAt
      })
      .eq('id', bolaoId);

    if (updateError) throw updateError;

    // 9. Insert final bets
    const betsToInsert = closureData.finalBets.map(bet => ({
      bolao_id: bolaoId,
      bet_type: bet.type,
      numbers: bet.numbers
    }));

    const { error: betsError } = await supabase
      .from('final_bets')
      .insert(betsToInsert);

    if (betsError) throw betsError;

    console.log('✅ Bolão closed successfully');

    return {
      success: true,
      hash,
      closureData,
      finalBets: closureData.finalBets
    };

  } catch (error) {
    console.error('Error closing bolão:', error);
    throw error;
  }
}

/**
 * Get closure information for a closed bolão
 * @param {string} bolaoId - Bolão ID
 * @returns {object} Closure information
 */
export async function getClosureInfo(bolaoId) {
  try {
    const { data: bolao, error } = await supabase
      .from('bolao')
      .select('status, closure_hash, closure_data, closed_at')
      .eq('id', bolaoId)
      .single();

    if (error) throw error;

    if (bolao.status !== CONFIG.BOLAO_STATUS.CLOSED) {
      throw new Error('Bolão is not closed');
    }

    return {
      status: bolao.status,
      hash: bolao.closure_hash,
      closedAt: bolao.closed_at,
      closureData: bolao.closure_data
    };
  } catch (error) {
    console.error('Error getting closure info:', error);
    throw error;
  }
}

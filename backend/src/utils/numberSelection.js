/**
 * Smart Number Selection Utilities
 * Implements pattern-aware selection for lottery bets
 */

// ===== VALIDAÇÃO DE PADRÕES =====

/**
 * Detecta números consecutivos em uma seleção
 * @param {Array<number>} numbers - Números ordenados
 * @returns {object} { hasIssue: boolean, maxSequence: number, sequences: Array }
 */
export function hasConsecutiveIssue(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  let maxSequence = 1;
  let currentSequence = 1;
  const sequences = [];
  let sequenceStart = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      currentSequence++;
      if (currentSequence > maxSequence) {
        maxSequence = currentSequence;
      }
    } else {
      if (currentSequence >= 3) {
        sequences.push({
          start: sequenceStart,
          end: sorted[i - 1],
          length: currentSequence
        });
      }
      currentSequence = 1;
      sequenceStart = sorted[i];
    }
  }

  // Check last sequence
  if (currentSequence >= 3) {
    sequences.push({
      start: sequenceStart,
      end: sorted[sorted.length - 1],
      length: currentSequence
    });
  }

  return {
    hasIssue: maxSequence >= 3,
    maxSequence,
    sequences
  };
}

/**
 * Calcula balanceamento de paridade (pares/ímpares)
 * @param {Array<number>} numbers - Números a analisar
 * @returns {object} { evenCount, oddCount, ratio, isBalanced }
 */
export function getParityBalance(numbers) {
  const evenCount = numbers.filter(n => n % 2 === 0).length;
  const oddCount = numbers.length - evenCount;
  const ratio = evenCount / numbers.length;

  // Ideal: 30-70% de pares
  const isBalanced = ratio >= 0.3 && ratio <= 0.7;

  return {
    evenCount,
    oddCount,
    ratio: Math.round(ratio * 100) / 100,
    isBalanced
  };
}

/**
 * Analisa distribuição por faixas (décadas)
 * @param {Array<number>} numbers - Números a analisar
 * @returns {object} { ranges, diversity, isWellDistributed }
 */
export function getDecadeDistribution(numbers) {
  const ranges = {
    '1-20': numbers.filter(n => n >= 1 && n <= 20).length,
    '21-40': numbers.filter(n => n >= 21 && n <= 40).length,
    '41-60': numbers.filter(n => n >= 41 && n <= 60).length
  };

  const usedRanges = Object.values(ranges).filter(count => count > 0).length;
  const maxConcentration = Math.max(...Object.values(ranges)) / numbers.length;

  return {
    ranges,
    diversity: usedRanges,
    isWellDistributed: usedRanges >= 2 && maxConcentration <= 0.7
  };
}

/**
 * Analisa múltiplos de 5 e 10
 * @param {Array<number>} numbers - Números a analisar
 * @returns {object} { multiplesOf5, multiplesOf10, hasIssue }
 */
export function getMultiplesAnalysis(numbers) {
  const multiplesOf5 = numbers.filter(n => n % 5 === 0);
  const multiplesOf10 = numbers.filter(n => n % 10 === 0);

  const ratio5 = multiplesOf5.length / numbers.length;
  const hasIssue = ratio5 > 0.4 || multiplesOf10.length > 2;

  return {
    multiplesOf5: multiplesOf5.length,
    multiplesOf10: multiplesOf10.length,
    ratio5: Math.round(ratio5 * 100) / 100,
    hasIssue
  };
}

/**
 * Validação completa de uma seleção
 * @param {Array<number>} numbers - Números a validar
 * @returns {object} { isValid, issues: Array, quality: number }
 */
export function validateSelection(numbers) {
  const issues = [];

  // 1. Consecutivos
  const consecutive = hasConsecutiveIssue(numbers);
  if (consecutive.hasIssue) {
    issues.push({
      type: 'consecutive',
      severity: consecutive.maxSequence >= 4 ? 'high' : 'medium',
      message: `Sequência de ${consecutive.maxSequence} números consecutivos`,
      data: consecutive.sequences
    });
  }

  // 2. Paridade
  const parity = getParityBalance(numbers);
  if (!parity.isBalanced) {
    const severity = (parity.ratio < 0.2 || parity.ratio > 0.8) ? 'medium' : 'low';
    issues.push({
      type: 'parity',
      severity,
      message: `Desbalanceamento: ${parity.evenCount} pares, ${parity.oddCount} ímpares`,
      data: parity
    });
  }

  // 3. Distribuição de faixas
  const distribution = getDecadeDistribution(numbers);
  if (!distribution.isWellDistributed) {
    issues.push({
      type: 'distribution',
      severity: distribution.diversity === 1 ? 'high' : 'low',
      message: `Concentração em ${distribution.diversity} faixa(s)`,
      data: distribution.ranges
    });
  }

  // 4. Múltiplos
  const multiples = getMultiplesAnalysis(numbers);
  if (multiples.hasIssue) {
    issues.push({
      type: 'multiples',
      severity: multiples.multiplesOf10 > 2 ? 'medium' : 'low',
      message: `${multiples.multiplesOf5} múltiplos de 5, ${multiples.multiplesOf10} de 10`,
      data: multiples
    });
  }

  // Calcular qualidade geral
  const quality = scoreSelectionQuality(numbers);

  return {
    isValid: quality >= 60, // Threshold mínimo
    issues,
    quality
  };
}

/**
 * Score de qualidade de 0-100
 * @param {Array<number>} numbers - Números a pontuar
 * @returns {number} Score de 0-100 (maior = melhor)
 */
export function scoreSelectionQuality(numbers) {
  let score = 100;

  // Penalidades por consecutivos
  const consecutive = hasConsecutiveIssue(numbers);
  if (consecutive.maxSequence >= 5) {
    score -= 40;
  } else if (consecutive.maxSequence === 4) {
    score -= 25;
  } else if (consecutive.maxSequence === 3) {
    score -= 10;
  }

  // Penalidades por paridade
  const parity = getParityBalance(numbers);
  if (!parity.isBalanced) {
    if (parity.ratio < 0.2 || parity.ratio > 0.8) {
      score -= 20;
    } else {
      score -= 10;
    }
  }

  // Penalidades por distribuição
  const distribution = getDecadeDistribution(numbers);
  if (distribution.diversity === 1) {
    score -= 30;
  } else if (distribution.diversity === 2) {
    score -= 5;
  }

  // Penalidades por múltiplos
  const multiples = getMultiplesAnalysis(numbers);
  if (multiples.multiplesOf10 > 2) {
    score -= 15;
  }
  if (multiples.ratio5 > 0.5) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ===== SELEÇÃO INTELIGENTE =====

/**
 * Verifica se adicionar um número criará 3+ consecutivos
 * @param {Array<number>} selected - Números já selecionados
 * @param {number} candidate - Número candidato
 * @returns {boolean} True se criar problema
 */
function wouldCreateConsecutive(selected, candidate) {
  const temp = [...selected, candidate].sort((a, b) => a - b);
  let sequence = 1;

  for (let i = 1; i < temp.length; i++) {
    if (temp[i] === temp[i - 1] + 1) {
      sequence++;
      if (sequence >= 3) return true;
    } else {
      sequence = 1;
    }
  }

  return false;
}

/**
 * Verifica se adicionar um número criaria desbalanceamento de paridade
 * @param {Array<number>} selected - Números já selecionados
 * @param {number} candidate - Número candidato
 * @param {number} targetCount - Total desejado
 * @returns {boolean} True se ok adicionar
 */
function wouldMaintainParity(selected, candidate, targetCount) {
  const temp = [...selected, candidate];
  const evenCount = temp.filter(n => n % 2 === 0).length;
  const ratio = evenCount / temp.length;

  // Mais permissivo durante seleção, restritivo no final
  const progress = temp.length / targetCount;
  if (progress < 0.5) return true; // Primeiros 50% livre

  return ratio >= 0.2 && ratio <= 0.8;
}

/**
 * Seleciona os melhores N números de um pool de candidatos
 * Algoritmo guloso com validação de padrões
 *
 * @param {Array<{number: number, score: number, votes?: number}>} candidates - Candidatos ordenados
 * @param {number} count - Quantos números selecionar
 * @param {object} options - Opções de seleção
 * @returns {Array<number>} Números selecionados (ordenados)
 */
export function selectBestNumbers(candidates, count, options = {}) {
  const {
    strictness = 'medium', // 'low', 'medium', 'high'
    minQualityScore = 60 // Score mínimo aceitável
  } = options;

  console.log(`🎯 Selecting ${count} numbers from ${candidates.length} candidates (strictness: ${strictness})`);

  // Ordena candidatos por score DESC (ou votes DESC, score DESC)
  const sorted = [...candidates].sort((a, b) => {
    if (a.votes !== undefined && b.votes !== undefined) {
      if (b.votes !== a.votes) return b.votes - a.votes;
    }
    return b.score - a.score;
  });

  const selected = [];
  const skipped = [];

  // Algoritmo guloso com validação
  for (const candidate of sorted) {
    if (selected.length === count) break;

    const num = candidate.number;

    // Verificações básicas
    if (selected.includes(num)) continue;

    // Verificar consecutivos
    if (strictness !== 'low' && wouldCreateConsecutive(selected, num)) {
      skipped.push({ num, reason: 'consecutive' });
      continue;
    }

    // Verificar paridade
    if (strictness === 'high' && !wouldMaintainParity(selected, num, count)) {
      skipped.push({ num, reason: 'parity' });
      continue;
    }

    // Adiciona o número
    selected.push(num);
  }

  // Se não conseguiu selecionar o suficiente, relaxa critérios
  if (selected.length < count) {
    console.log(`⚠️  Only selected ${selected.length}/${count}. Relaxing criteria...`);

    // Adiciona números pulados, começando pelos de maior score
    for (const { num } of skipped) {
      if (selected.length === count) break;
      if (!selected.includes(num)) {
        selected.push(num);
      }
    }

    // Se ainda falta, pega qualquer candidato restante
    if (selected.length < count) {
      for (const candidate of sorted) {
        if (selected.length === count) break;
        if (!selected.includes(candidate.number)) {
          selected.push(candidate.number);
        }
      }
    }
  }

  // Ordena resultado
  const result = selected.sort((a, b) => a - b);

  // Validação final
  const validation = validateSelection(result);

  console.log(`✅ Selected: ${result.join(', ')}`);
  console.log(`   Quality: ${validation.quality}/100`);
  if (validation.issues.length > 0) {
    console.log(`   Issues: ${validation.issues.map(i => i.type).join(', ')}`);
  }

  return result;
}

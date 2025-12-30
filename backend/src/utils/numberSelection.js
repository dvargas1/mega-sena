/**
 * Smart Number Selection Utilities
 * Implements pattern-aware selection for lottery bets
 */

// ===== VALIDAÇÃO DE PADRÕES =====

/**
 * Detecta números consecutivos em uma seleção
 * @param {Array<number>} numbers - Números ordenados
 * @returns {object} { hasIssue: boolean, maxSequence: number, sequences: Array, pairCount: number }
 */
export function hasConsecutiveIssue(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  let maxSequence = 1;
  let currentSequence = 1;
  const sequences = [];
  const pairs = [];
  let sequenceStart = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      currentSequence++;
      if (currentSequence > maxSequence) {
        maxSequence = currentSequence;
      }
    } else {
      if (currentSequence >= 2) {
        const seq = {
          start: sequenceStart,
          end: sorted[i - 1],
          length: currentSequence
        };
        if (currentSequence >= 3) {
          sequences.push(seq);
        } else if (currentSequence === 2) {
          pairs.push(seq);
        }
      }
      currentSequence = 1;
      sequenceStart = sorted[i];
    }
  }

  // Check last sequence
  if (currentSequence >= 2) {
    const seq = {
      start: sequenceStart,
      end: sorted[sorted.length - 1],
      length: currentSequence
    };
    if (currentSequence >= 3) {
      sequences.push(seq);
    } else if (currentSequence === 2) {
      pairs.push(seq);
    }
  }

  // Issue if: 3+ consecutive OR multiple pairs of consecutive
  const hasIssue = maxSequence >= 3 || pairs.length > 1;

  return {
    hasIssue,
    maxSequence,
    sequences,
    pairs,
    pairCount: pairs.length
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
 * @returns {object} { ranges, diversity, isWellDistributed, minCoverage }
 */
export function getDecadeDistribution(numbers) {
  const ranges = {
    '1-20': numbers.filter(n => n >= 1 && n <= 20).length,
    '21-40': numbers.filter(n => n >= 21 && n <= 40).length,
    '41-60': numbers.filter(n => n >= 41 && n <= 60).length
  };

  const usedRanges = Object.values(ranges).filter(count => count > 0).length;
  const maxConcentration = Math.max(...Object.values(ranges)) / numbers.length;
  const minInRange = Math.min(...Object.values(ranges).filter(v => v > 0));

  // Para apostas grandes (7+), exigir pelo menos 2 números em cada faixa usada
  // Para apostas pequenas (6), exigir pelo menos 2 faixas
  const betSize = numbers.length;
  let isWellDistributed;

  if (betSize >= 8) {
    // Apostas grandes: exigir 3 faixas E mínimo 2 em cada E max 60% concentração
    isWellDistributed = usedRanges === 3 && minInRange >= 2 && maxConcentration <= 0.6;
  } else if (betSize === 7) {
    // 7 números: exigir pelo menos 2 faixas E mínimo 2 em cada E max 65% concentração
    isWellDistributed = usedRanges >= 2 && minInRange >= 2 && maxConcentration <= 0.65;
  } else {
    // 6 números: critério original (2 faixas, max 70%)
    isWellDistributed = usedRanges >= 2 && maxConcentration <= 0.7;
  }

  return {
    ranges,
    diversity: usedRanges,
    isWellDistributed,
    minCoverage: minInRange,
    maxConcentration: Math.round(maxConcentration * 100) / 100
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
    let message;
    let severity;

    if (consecutive.maxSequence >= 4) {
      message = `Sequência de ${consecutive.maxSequence} números consecutivos`;
      severity = 'high';
    } else if (consecutive.maxSequence === 3) {
      message = `Sequência de 3 números consecutivos`;
      severity = 'medium';
    } else if (consecutive.pairCount > 1) {
      message = `${consecutive.pairCount} pares de números consecutivos`;
      severity = 'medium';
    }

    issues.push({
      type: 'consecutive',
      severity,
      message,
      data: { sequences: consecutive.sequences, pairs: consecutive.pairs }
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
    score -= 15;
  }

  // Penalidade adicional por múltiplos pares
  if (consecutive.pairCount > 1) {
    score -= (consecutive.pairCount - 1) * 15; // -15 por cada par extra
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
    score -= 40; // Tudo em uma faixa é muito ruim
  } else if (distribution.diversity === 2) {
    // Penalizar por concentração alta
    if (distribution.maxConcentration > 0.7) {
      score -= 20;
    } else if (distribution.maxConcentration > 0.6) {
      score -= 10;
    } else {
      score -= 5;
    }
  }
  // 3 faixas é ideal, sem penalidade

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
 * Gera números aleatórios com distribuição forçada
 * @param {number} count - Quantos números gerar
 * @param {Array<number>} exclude - Números a excluir (opcional)
 * @returns {Array<number>} Números aleatórios com boa distribuição
 */
function generateRandomWithDistribution(count, exclude = []) {
  const selected = [];
  const available = Array.from({ length: 60 }, (_, i) => i + 1)
    .filter(n => !exclude.includes(n));

  // Determinar distribuição ideal por faixa
  let targetPerRange;
  if (count >= 9) {
    targetPerRange = { low: 3, mid: 3, high: 3 }; // 3-3-3
  } else if (count === 8) {
    targetPerRange = { low: 3, mid: 3, high: 2 }; // 3-3-2
  } else if (count === 7) {
    targetPerRange = { low: 2, mid: 2, high: 3 }; // 2-2-3
  } else {
    targetPerRange = { low: 2, mid: 2, high: 2 }; // 2-2-2 para 6
  }

  // Separar disponíveis por faixa
  const ranges = {
    low: available.filter(n => n >= 1 && n <= 20),
    mid: available.filter(n => n >= 21 && n <= 40),
    high: available.filter(n => n >= 41 && n <= 60)
  };

  // Selecionar de cada faixa
  for (const [range, target] of Object.entries(targetPerRange)) {
    const pool = ranges[range];
    for (let i = 0; i < target && pool.length > 0; i++) {
      // Selecionar aleatório da faixa
      let attempts = 0;
      let candidate;

      do {
        const idx = Math.floor(Math.random() * pool.length);
        candidate = pool[idx];
        pool.splice(idx, 1); // Remove para não repetir
        attempts++;
      } while (
        attempts < 10 &&
        pool.length > 0 &&
        wouldCreateConsecutive(selected, candidate)
      );

      selected.push(candidate);
    }
  }

  // Se ainda falta (improvável), preencher com qualquer disponível
  while (selected.length < count && available.length > 0) {
    const remaining = available.filter(n => !selected.includes(n));
    if (remaining.length === 0) break;

    const idx = Math.floor(Math.random() * remaining.length);
    selected.push(remaining[idx]);
  }

  return selected.sort((a, b) => a - b);
}

/**
 * Verifica se adicionar um número criará 3+ consecutivos ou múltiplos pares
 * @param {Array<number>} selected - Números já selecionados
 * @param {number} candidate - Número candidato
 * @returns {boolean} True se criar problema
 */
function wouldCreateConsecutive(selected, candidate) {
  const temp = [...selected, candidate].sort((a, b) => a - b);

  // Usar a função de validação completa
  const check = hasConsecutiveIssue(temp);

  // Rejeitar se criar 3+ consecutivos OU mais de 1 par
  return check.hasIssue;
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
 * Verifica se adicionar um número manteria boa distribuição por faixas
 * @param {Array<number>} selected - Números já selecionados
 * @param {number} candidate - Número candidato
 * @param {number} targetCount - Total desejado
 * @returns {boolean} True se ok adicionar
 */
function wouldMaintainDistribution(selected, candidate, targetCount) {
  const temp = [...selected, candidate];
  const progress = temp.length / targetCount;

  // Primeiros 50%: livre
  if (progress < 0.5) return true;

  // A partir de 50%: verificar concentração
  const ranges = {
    low: temp.filter(n => n >= 1 && n <= 20).length,
    mid: temp.filter(n => n >= 21 && n <= 40).length,
    high: temp.filter(n => n >= 41 && n <= 60).length
  };

  const maxConcentration = Math.max(ranges.low, ranges.mid, ranges.high) / temp.length;

  // Para apostas grandes (8+), exigir máximo 60% em uma faixa
  // Para apostas médias (7), exigir máximo 65%
  // Para apostas pequenas (6), exigir máximo 70%
  if (targetCount >= 8) {
    return maxConcentration <= 0.6;
  } else if (targetCount === 7) {
    return maxConcentration <= 0.65;
  } else {
    return maxConcentration <= 0.7;
  }
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

    // Verificar distribuição (medium e high)
    if (strictness !== 'low' && !wouldMaintainDistribution(selected, num, count)) {
      skipped.push({ num, reason: 'distribution' });
      continue;
    }

    // Verificar paridade (apenas high)
    if (strictness === 'high' && !wouldMaintainParity(selected, num, count)) {
      skipped.push({ num, reason: 'parity' });
      continue;
    }

    // Adiciona o número
    selected.push(num);
  }

  // Se não conseguiu selecionar o suficiente, usa geração aleatória com distribuição forçada
  if (selected.length < count) {
    console.log(`⚠️  Only selected ${selected.length}/${count}. Using random distribution fallback...`);

    // Gerar números aleatórios com boa distribuição
    const randomNumbers = generateRandomWithDistribution(count, selected);

    // Substituir seleção parcial por números aleatórios bem distribuídos
    selected.length = 0; // Limpar
    selected.push(...randomNumbers);

    console.log(`   ✅ Generated ${count} numbers with forced distribution`);
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

import express from 'express';
import { supabase } from '../config/database.js';
import { CONFIG } from '../config/constants.js';
import { getClosureInfo } from '../services/closure.js';

const router = express.Router();

/**
 * GET /api/bolao/info
 * Get current bolão information
 */
router.get('/info', async (req, res) => {
  try {
    // Get active bolão
    const { data: bolao, error: bolaoError } = await supabase
      .from('bolao')
      .select('*')
      .eq('status', CONFIG.BOLAO_STATUS.OPEN)
      .single();

    if (bolaoError || !bolao) {
      // Check if there's a closed bolão
      const { data: closedBolao, error: closedError } = await supabase
        .from('bolao')
        .select('*')
        .eq('status', CONFIG.BOLAO_STATUS.CLOSED)
        .order('closed_at', { ascending: false })
        .limit(1)
        .single();

      if (closedBolao) {
        return res.json({
          success: true,
          status: 'closed',
          bolao: {
            id: closedBolao.id,
            name: closedBolao.name,
            status: closedBolao.status,
            closedAt: closedBolao.closed_at
          }
        });
      }

      return res.status(404).json({
        success: false,
        error: 'Nenhum bolão encontrado'
      });
    }

    // Count participations
    const { data: allParticipants, error: allError } = await supabase
      .from('participations')
      .select('id, payment_status, quota_quantity')
      .eq('bolao_id', bolao.id);

    if (allError) throw allError;

    const totalParticipants = allParticipants ? allParticipants.length : 0;
    const confirmedParticipants = allParticipants
      ? allParticipants.filter(p => p.payment_status === CONFIG.PAYMENT_STATUS.CONFIRMED).length
      : 0;

    // Calculate total quotas and funds
    const totalQuotas = allParticipants
      ? allParticipants
          .filter(p => p.payment_status === CONFIG.PAYMENT_STATUS.CONFIRMED)
          .reduce((sum, p) => sum + (p.quota_quantity || 1), 0)
      : 0;

    const totalFunds = totalQuotas * parseFloat(bolao.quota_value);

    res.json({
      success: true,
      bolao: {
        id: bolao.id,
        name: bolao.name,
        quotaValue: parseFloat(bolao.quota_value),
        status: bolao.status,
        participantCount: totalParticipants,
        confirmedCount: confirmedParticipants,
        totalQuotas: totalQuotas,
        totalFunds: totalFunds,
        createdAt: bolao.created_at
      }
    });
  } catch (error) {
    console.error('Get bolão info error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar informações do bolão'
    });
  }
});

/**
 * GET /api/bolao/participants
 * Get list of all participants (public endpoint)
 */
router.get('/participants', async (req, res) => {
  try {
    // Get active bolão
    const { data: bolao, error: bolaoError } = await supabase
      .from('bolao')
      .select('id, quota_value')
      .eq('status', CONFIG.BOLAO_STATUS.OPEN)
      .single();

    if (bolaoError || !bolao) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum bolão aberto encontrado'
      });
    }

    // Get all participations with user info and selection count
    const { data: participations, error: partError } = await supabase
      .from('participations')
      .select(`
        id,
        quota_quantity,
        payment_status,
        created_at,
        users!participations_user_id_fkey(id, name),
        number_selections(number)
      `)
      .eq('bolao_id', bolao.id)
      .order('created_at', { ascending: true });

    if (partError) throw partError;

    const quotaValue = parseFloat(bolao.quota_value) || 10;

    // Transform data (without sensitive info like payment confirmation dates)
    const participants = participations.map(p => ({
      participationId: p.id,
      name: p.users.name,
      quotaQuantity: p.quota_quantity || 1,
      totalAmount: (p.quota_quantity || 1) * quotaValue,
      paymentStatus: p.payment_status,
      joinedAt: p.created_at,
      selectedNumbersCount: p.number_selections ? p.number_selections.length : 0,
      selectedNumbers: p.number_selections ? p.number_selections.map(ns => ns.number).sort((a, b) => a - b) : []
    }));

    res.json({
      success: true,
      participants
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar participantes'
    });
  }
});

/**
 * GET /api/bolao/closure
 * Get closure information (only if closed)
 */
router.get('/closure', async (req, res) => {
  try {
    // Try to get latest closed bolão
    const { data: bolao, error: bolaoError } = await supabase
      .from('bolao')
      .select('id')
      .eq('status', CONFIG.BOLAO_STATUS.CLOSED)
      .order('closed_at', { ascending: false })
      .limit(1)
      .single();

    if (bolaoError || !bolao) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum bolão encerrado encontrado'
      });
    }

    // Get closure info
    const closureInfo = await getClosureInfo(bolao.id);

    res.json({
      success: true,
      ...closureInfo
    });
  } catch (error) {
    console.error('Get closure info error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar informações de encerramento'
    });
  }
});

export default router;

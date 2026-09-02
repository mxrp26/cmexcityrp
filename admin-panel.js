/**
 * PANEL ADMINISTRATIVO PRIVADO
 * Gestión segura de jugadores, banco y datos sensibles
 * Solo accesible por administradores autenticados
 */

class AdminPanel {
  constructor() {
    this.supabase = null;
    this.currentAdmin = null;
    this.isAdmin = false;
    this.init();
  }

  async init() {
    const { createClient } = window.supabase;
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    // Verificar si el usuario es admin
    await this.checkAdminAccess();
  }

  // ========================================
  // VERIFICACIÓN DE ACCESO ADMINISTRATIVO
  // ========================================

  async checkAdminAccess() {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        this.redirectToLogin();
        return false;
      }

      // Verificar permisos de admin en la tabla users
      const { data: userData, error } = await this.supabase
        .from('users')
        .select('is_admin, is_banned')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (!userData.is_admin) {
        this.logSecurityEvent('Acceso denegado - Usuario no es admin');
        this.redirectToLogin();
        return false;
      }

      if (userData.is_banned) {
        this.logSecurityEvent('Intento de acceso con cuenta baneada');
        this.redirectToLogin();
        return false;
      }

      this.currentAdmin = user;
      this.isAdmin = true;
      this.logSecurityEvent('Acceso admin autorizado', user.id);

      return true;
    } catch (error) {
      console.error('Error verificando acceso admin:', error);
      return false;
    }
  }

  // ========================================
  // GESTIÓN DE JUGADORES (VISTA DE ADMIN)
  // ========================================

  async getAllPlayers(filters = {}) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      let query = this.supabase
        .from('players')
        .select(`
          id,
          character_name,
          age,
          gender,
          city,
          occupation,
          is_alive,
          is_on_role,
          current_balance,
          created_at,
          updated_at,
          user:users(id, username, email),
          home:homes(type, value),
          organization:organizations(org_name, alias),
          family:families(family_name)
        `);

      // Aplicar filtros
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.isAlive !== undefined) {
        query = query.eq('is_alive', filters.isAlive);
      }
      if (filters.organization) {
        query = query.eq('organization_id', filters.organization);
      }

      const { data, error } = await query;

      if (error) throw error;

      this.logSecurityEvent('Consulta de jugadores', `Registros: ${data.length}`);

      return { success: true, players: data };
    } catch (error) {
      console.error('Error obteniendo jugadores:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // INFORMACIÓN SENSIBLE DEL JUGADOR
  // (Solo para admins autorizado)
  // ========================================

  async getPlayerSensitiveData(playerId) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      // Obtener datos del usuario (incluyendo email)
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id, username, email, created_at, is_banned')
        .eq('id', (await this.supabase
          .from('players')
          .select('user_id')
          .eq('id', playerId)
          .single()).data.user_id)
        .single();

      if (userError) throw userError;

      // Obtener datos del jugador
      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (playerError) throw playerError;

      // Registrar acceso a datos sensibles
      this.logSecurityEvent(
        'Acceso a datos sensibles de jugador',
        `Player: ${player.character_name}, Email: ${userData.email}`
      );

      return {
        success: true,
        player: player,
        user: {
          email: userData.email,
          username: userData.username,
          createdAt: userData.created_at,
          isBanned: userData.is_banned
        }
      };
    } catch (error) {
      console.error('Error obteniendo datos sensibles:', error);
      this.logSecurityEvent('Intento fallido de acceso a datos sensibles', playerId);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // GESTIÓN DE CUENTAS BANCARIAS
  // ========================================

  async getBankAccount(playerId) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      const { data: bankAccount, error } = await this.supabase
        .from('bank_accounts')
        .select('*')
        .eq('player_id', playerId)
        .single();

      if (error) throw error;

      this.logSecurityEvent('Consulta de cuenta bancaria', `Account: ${bankAccount.account_number}`);

      return { success: true, bankAccount };
    } catch (error) {
      console.error('Error obteniendo cuenta bancaria:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllBankAccounts(filters = {}) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      let query = this.supabase
        .from('bank_accounts')
        .select(`
          id,
          account_number,
          account_holder,
          balance,
          created_at,
          player:players(id, character_name, is_alive)
        `);

      if (filters.minBalance) {
        query = query.gte('balance', filters.minBalance);
      }
      if (filters.maxBalance) {
        query = query.lte('balance', filters.maxBalance);
      }

      const { data, error } = await query;

      if (error) throw error;

      this.logSecurityEvent('Consulta de cuentas bancarias', `Total: ${data.length}`);

      return { success: true, accounts: data };
    } catch (error) {
      console.error('Error obteniendo cuentas:', error);
      return { success: false, error: error.message };
    }
  }

  async getBankTransactions(playerId, limit = 100) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      const { data: account, error: accountError } = await this.supabase
        .from('bank_accounts')
        .select('id')
        .eq('player_id', playerId)
        .single();

      if (accountError) throw accountError;

      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select(`
          id,
          transaction_type,
          amount,
          description,
          status,
          created_at,
          from_player:from_player_id(character_name),
          to_player:to_player_id(character_name)
        `)
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      this.logSecurityEvent('Consulta de transacciones', `Account: ${account.id}, Registros: ${transactions.length}`);

      return { success: true, transactions };
    } catch (error) {
      console.error('Error obteniendo transacciones:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // GESTIÓN DE PRÉSTAMOS
  // ========================================

  async getLoanRequests(status = null) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      let query = this.supabase
        .from('loans')
        .select(`
          id,
          amount,
          reason,
          status,
          weekly_payment,
          requested_at,
          player:players(id, character_name, city)
        `);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('requested_at', { ascending: false });

      if (error) throw error;

      this.logSecurityEvent('Consulta de préstamos', `Status: ${status}, Registros: ${data.length}`);

      return { success: true, loans: data };
    } catch (error) {
      console.error('Error obteniendo préstamos:', error);
      return { success: false, error: error.message };
    }
  }

  async approveLoan(loanId, approvedAmount = null) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      const { data: loan, error: loanError } = await this.supabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .single();

      if (loanError) throw loanError;

      const finalAmount = approvedAmount || loan.amount;
      const weeklyPayment = finalAmount * (APP_CONFIG.prices.loanInterest / 100);

      const { error: updateError } = await this.supabase
        .from('loans')
        .update({
          status: 'approved',
          amount: finalAmount,
          weekly_payment: weeklyPayment,
          approved_at: new Date().toISOString(),
          approved_by: this.currentAdmin.id
        })
        .eq('id', loanId);

      if (updateError) throw updateError;

      // Crear transacción de préstamo
      const { data: account } = await this.supabase
        .from('bank_accounts')
        .select('id')
        .eq('player_id', loan.player_id)
        .single();

      if (account) {
        await this.supabase
          .from('transactions')
          .insert([{
            account_id: account.id,
            transaction_type: 'loan',
            amount: finalAmount,
            description: `Préstamo aprobado - ${loan.reason}`,
            reference_id: loanId,
            status: 'completed'
          }]);
      }

      this.logSecurityEvent(
        'Préstamo aprobado',
        `Loan ID: ${loanId}, Monto: $${finalAmount}, Pago semanal: $${weeklyPayment}`
      );

      return { success: true, message: 'Préstamo aprobado correctamente' };
    } catch (error) {
      console.error('Error aprobando préstamo:', error);
      return { success: false, error: error.message };
    }
  }

  async rejectLoan(loanId, reason) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      const { error } = await this.supabase
        .from('loans')
        .update({
          status: 'rejected',
          approved_at: new Date().toISOString(),
          approved_by: this.currentAdmin.id
        })
        .eq('id', loanId);

      if (error) throw error;

      this.logSecurityEvent('Préstamo rechazado', `Loan ID: ${loanId}, Razón: ${reason}`);

      return { success: true, message: 'Préstamo rechazado' };
    } catch (error) {
      console.error('Error rechazando préstamo:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // GESTIÓN DE SERVICIOS AUTOMÁTICOS
  // ========================================

  async getServices() {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      const { data, error } = await this.supabase
        .from('services')
        .select(`
          id,
          service_type,
          amount,
          is_active,
          player:players(character_name),
          receiver_player:receiver_player_id(character_name),
          receiver_business:receiver_business_id(business_name)
        `)
        .eq('is_active', true);

      if (error) throw error;

      this.logSecurityEvent('Consulta de servicios', `Total: ${data.length}`);

      return { success: true, services: data };
    } catch (error) {
      console.error('Error obteniendo servicios:', error);
      return { success: false, error: error.message };
    }
  }

  async setServiceReceiver(serviceType, receiverPlayerId = null, receiverBusinessId = null) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      const { error } = await this.supabase
        .from('services')
        .update({
          receiver_player_id: receiverPlayerId,
          receiver_business_id: receiverBusinessId
        })
        .eq('service_type', serviceType);

      if (error) throw error;

      this.logSecurityEvent(
        'Receptor de servicio actualizado',
        `Servicio: ${serviceType}, Player: ${receiverPlayerId}, Business: ${receiverBusinessId}`
      );

      return { success: true, message: 'Receptor actualizado' };
    } catch (error) {
      console.error('Error actualizando receptor:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // GESTIÓN DE USUARIOS
  // ========================================

  async banPlayer(playerId, reason) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      // Obtener usuario del jugador
      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .select('user_id')
        .eq('id', playerId)
        .single();

      if (playerError) throw playerError;

      // Banear usuario
      const { error } = await this.supabase
        .from('users')
        .update({
          is_banned: true,
          ban_reason: reason
        })
        .eq('id', player.user_id);

      if (error) throw error;

      this.logSecurityEvent('Jugador baneado', `Player ID: ${playerId}, Razón: ${reason}`);

      return { success: true, message: 'Jugador baneado correctamente' };
    } catch (error) {
      console.error('Error baneando jugador:', error);
      return { success: false, error: error.message };
    }
  }

  async unbanPlayer(playerId) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .select('user_id')
        .eq('id', playerId)
        .single();

      if (playerError) throw playerError;

      const { error } = await this.supabase
        .from('users')
        .update({
          is_banned: false,
          ban_reason: null
        })
        .eq('id', player.user_id);

      if (error) throw error;

      this.logSecurityEvent('Jugador desbaneado', `Player ID: ${playerId}`);

      return { success: true, message: 'Jugador desbaneado' };
    } catch (error) {
      console.error('Error desbaneando jugador:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // AUDITORÍA Y LOGS DE SEGURIDAD
  // ========================================

  async logSecurityEvent(action, details) {
    try {
      const user = authManager.getCurrentUser();
      if (!user) return;

      await this.supabase
        .from('admin_logs')
        .insert([{
          admin_id: user.id,
          action: action,
          details: { info: details, timestamp: new Date().toISOString() }
        }]);
    } catch (error) {
      console.error('Error registrando evento de seguridad:', error);
    }
  }

  async getAuditLog(limit = 100) {
    try {
      if (!this.isAdmin) throw new Error('Acceso denegado');

      const { data, error } = await this.supabase
        .from('admin_logs')
        .select(`
          id,
          action,
          details,
          created_at,
          admin:users(username)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, logs: data };
    } catch (error) {
      console.error('Error obteniendo audit log:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // UTILIDADES
  // ========================================

  redirectToLogin() {
    window.location.href = '/index.html';
  }

  isAdminUser() {
    return this.isAdmin;
  }

  getCurrentAdminUser() {
    return this.currentAdmin;
  }
}

// Instancia global
const adminPanel = new AdminPanel();

/**
 * SISTEMA DE AUTENTICACIÓN
 * Gestiona login, registro y sesión de usuarios
 */

class AuthManager {
  constructor() {
    this.supabase = null;
    this.currentUser = null;
    this.init();
  }

  async init() {
    // Inicializar Supabase
    const { createClient } = window.supabase;
    this.supabase = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey
    );

    // Verificar sesión existente
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadUserData();
    }
  }

  // Registro de nuevo usuario
  async register(email, password, username) {
    try {
      // Crear cuenta en Auth
      const { data: { user }, error: authError } = await this.supabase.auth.signUp({
        email,
        password
      });

      if (authError) throw authError;

      // Guardar datos en tabla users
      const { error: dbError } = await this.supabase
        .from('users')
        .insert([{
          id: user.id,
          username,
          email
        }]);

      if (dbError) throw dbError;

      // Crear cuenta bancaria automática
      await this.createBankAccount(user.id, username);

      this.currentUser = user;
      return { success: true, user };
    } catch (error) {
      console.error('Error en registro:', error);
      return { success: false, error: error.message };
    }
  }

  // Login
  async login(email, password) {
    try {
      const { data: { user }, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      this.currentUser = user;
      await this.loadUserData();

      return { success: true, user };
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: error.message };
    }
  }

  // Logout
  async logout() {
    try {
      await this.supabase.auth.signOut();
      this.currentUser = null;
      localStorage.clear();
      window.location.href = '/index.html';
    } catch (error) {
      console.error('Error en logout:', error);
    }
  }

  // Cargar datos del usuario
  async loadUserData() {
    try {
      const { data: userData, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error) throw error;

      // Guardar en localStorage
      localStorage.setItem('userData', JSON.stringify(userData));

      // Cargar datos del jugador si existen
      await this.loadPlayerData();

      return userData;
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }

  // Cargar datos del jugador/personaje
  async loadPlayerData() {
    try {
      const { data: players, error } = await this.supabase
        .from('players')
        .select('*')
        .eq('user_id', this.currentUser.id);

      if (error) throw error;

      if (players && players.length > 0) {
        // Si tiene personajes, guardar el activo
        localStorage.setItem('currentPlayer', JSON.stringify(players[0]));
        localStorage.setItem('playersList', JSON.stringify(players));
      }

      return players;
    } catch (error) {
      console.error('Error cargando jugador:', error);
    }
  }

  // Crear cuenta bancaria automática
  async createBankAccount(userId, username) {
    try {
      const accountNumber = this.generateAccountNumber();

      const { error } = await this.supabase
        .from('bank_accounts')
        .insert([{
          account_number: accountNumber,
          account_holder: username,
          balance: APP_CONFIG.prices.startingBalance
        }]);

      if (error) throw error;

      return accountNumber;
    } catch (error) {
      console.error('Error creando cuenta bancaria:', error);
    }
  }

  // Generar número de cuenta
  generateAccountNumber() {
    const prefix = 'CB-RP-';
    const random = Math.random().toString().substring(2, 8);
    return prefix + random.padStart(6, '0');
  }

  // Verificar si es admin
  async isAdmin() {
    try {
      const userData = JSON.parse(localStorage.getItem('userData'));
      return userData?.is_admin || false;
    } catch {
      return false;
    }
  }

  // Obtener usuario actual
  getCurrentUser() {
    return this.currentUser;
  }

  // Verificar si está autenticado
  isAuthenticated() {
    return this.currentUser !== null;
  }
}

// Instancia global
const authManager = new AuthManager();

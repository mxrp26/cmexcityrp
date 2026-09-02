/**
 * SISTEMA DE GESTIÓN DE JUGADORES
 * Flujo en cascada: Jugador → Hogar → Empresa → Transporte → Familia → Organización
 */

class PlayerManager {
  constructor() {
    this.supabase = null;
    this.currentPlayer = null;
    this.registrationStep = 'player'; // player, home, business, transport, family, organization
    this.init();
  }

  async init() {
    const { createClient } = window.supabase;
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }

  // ========================================
  // PASO 1: REGISTRO DE JUGADOR
  // ========================================
  async registerPlayer(playerData) {
    try {
      const user = authManager.getCurrentUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Generar dirección ficticia automática
      const address = this.generateFictionalAddress(playerData.city);

      const { data: player, error } = await this.supabase
        .from('players')
        .insert([{
          user_id: user.id,
          character_name: playerData.characterName,
          age: playerData.age,
          gender: playerData.gender,
          blood_type: playerData.bloodType,
          city: playerData.city,
          address: address,
          occupation: playerData.occupation,
          avatar_url: playerData.avatarUrl || 'https://i.pravatar.cc/150?img=60',
          is_alive: true,
          current_balance: APP_CONFIG.prices.startingBalance
        }])
        .select()
        .single();

      if (error) throw error;

      this.currentPlayer = player;
      localStorage.setItem('currentPlayer', JSON.stringify(player));

      return {
        success: true,
        player,
        nextStep: 'home',
        message: '✅ Ficha de jugador creada. Ahora registra tu hogar.'
      };
    } catch (error) {
      console.error('Error en registro de jugador:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // PASO 2: REGISTRO DE HOGAR
  // ========================================
  async registerHome(homeData) {
    try {
      if (!this.currentPlayer) throw new Error('No hay jugador activo');

      const value = APP_CONFIG.prices.homeTypes[homeData.type] || 350000;
      const address = this.generateHomeAddress(this.currentPlayer.city, homeData.type);

      const { data: home, error } = await this.supabase
        .from('homes')
        .insert([{
          player_id: this.currentPlayer.id,
          type: homeData.type,
          city: this.currentPlayer.city,
          address: address,
          value: value,
          image_url: homeData.imageUrl || null
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        home,
        nextStep: 'business',
        message: '✅ Hogar registrado. ¿Tienes empresa?'
      };
    } catch (error) {
      console.error('Error en registro de hogar:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // PASO 3: REGISTRO DE EMPRESA (OPCIONAL)
  // ========================================
  async registerBusiness(businessData) {
    try {
      if (!this.currentPlayer) throw new Error('No hay jugador activo');

      // Validar que el salario no exceda 1 millón
      if (businessData.salary > APP_CONFIG.prices.maxSalary) {
        return {
          success: false,
          error: `El salario no puede exceder $${APP_CONFIG.prices.maxSalary}`
        };
      }

      const { data: business, error } = await this.supabase
        .from('businesses')
        .insert([{
          owner_id: this.currentPlayer.id,
          business_name: businessData.name,
          business_type: businessData.giro,
          description: businessData.description || '',
          image_url: businessData.imageUrl || null,
          city: this.currentPlayer.city,
          address: this.generateBusinessAddress(this.currentPlayer.city),
          opening_hours: this.parseWorkDays(businessData.workDays),
          is_online: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Actualizar jugador con empresa
      await this.supabase
        .from('players')
        .update({ occupation: businessData.giro })
        .eq('id', this.currentPlayer.id);

      return {
        success: true,
        business,
        nextStep: 'transport',
        message: '✅ Empresa registrada. Ahora registra tu transporte.'
      };
    } catch (error) {
      console.error('Error en registro de empresa:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // PASO 4: REGISTRO DE TRANSPORTE
  // ========================================
  async registerTransport(transportData) {
    try {
      if (!this.currentPlayer) throw new Error('No hay jugador activo');

      const plate = this.generatePlate();

      const { data: vehicle, error } = await this.supabase
        .from('vehicles')
        .insert([{
          player_id: this.currentPlayer.id,
          type: transportData.type,
          model: transportData.model,
          color: transportData.color,
          plate: plate,
          value: this.getTransportValue(transportData.type),
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        vehicle,
        plate,
        nextStep: 'family',
        message: '✅ Transporte registrado. ¿Tienes familia?'
      };
    } catch (error) {
      console.error('Error en registro de transporte:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // PASO 5: REGISTRO DE FAMILIA (OPCIONAL)
  // ========================================
  async registerFamily(familyData) {
    try {
      if (!this.currentPlayer) throw new Error('No hay jugador activo');

      // Crear familia si no existe
      let familyId = familyData.familyId;

      if (familyData.isNewFamily) {
        const { data: family, error: familyError } = await this.supabase
          .from('families')
          .insert([{
            family_name: familyData.familyName,
            description: familyData.description || ''
          }])
          .select()
          .single();

        if (familyError) throw familyError;
        familyId = family.id;
      }

      // Agregar jugador a familia
      const { error: memberError } = await this.supabase
        .from('family_members')
        .insert([{
          family_id: familyId,
          player_id: this.currentPlayer.id,
          family_role: familyData.familyRole
        }]);

      if (memberError) throw memberError;

      // Actualizar jugador
      await this.supabase
        .from('players')
        .update({ family_id: familyId })
        .eq('id', this.currentPlayer.id);

      return {
        success: true,
        familyId,
        nextStep: 'organization',
        message: '✅ Familia registrada. ¿Perteneces a una organización?'
      };
    } catch (error) {
      console.error('Error en registro de familia:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // PASO 6: REGISTRO DE ORGANIZACIÓN (OPCIONAL)
  // ========================================
  async registerOrganization(orgData) {
    try {
      if (!this.currentPlayer) throw new Error('No hay jugador activo');

      let organizationId = null;

      if (orgData.isLeader) {
        // Crear nueva organización
        const { data: org, error: orgError } = await this.supabase
          .from('organizations')
          .insert([{
            org_name: orgData.orgName,
            alias: orgData.alias || null,
            logo_url: orgData.logoUrl || null,
            description: orgData.giro || '',
            giro: orgData.giro,
            leader_id: this.currentPlayer.id,
            is_active: true
          }])
          .select()
          .single();

        if (orgError) throw orgError;
        organizationId = org.id;

        // Agregar salarios de cargos (máximo 20)
        const salaries = orgData.salaries.filter(s => s.cargo && s.salario);
        for (const salary of salaries) {
          await this.supabase
            .from('org_salary_config')
            .insert([{
              org_id: organizationId,
              cargo: salary.cargo,
              salary: salary.salario
            }]);
        }
      } else if (orgData.joinOrgId) {
        // Unirse a organización existente
        organizationId = orgData.joinOrgId;

        const { error: memberError } = await this.supabase
          .from('org_members')
          .insert([{
            org_id: organizationId,
            player_id: this.currentPlayer.id,
            cargo: orgData.cargo,
            salary: this.getSalaryForCargo(organizationId, orgData.cargo)
          }]);

        if (memberError) throw memberError;
      }

      // Actualizar jugador
      if (organizationId) {
        await this.supabase
          .from('players')
          .update({ organization_id: organizationId })
          .eq('id', this.currentPlayer.id);
      }

      return {
        success: true,
        organizationId,
        nextStep: 'complete',
        message: '✅ Organización registrada. ¡Registro completo!'
      };
    } catch (error) {
      console.error('Error en registro de organización:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // MÉTODOS AUXILIARES
  // ========================================

  generateFictionalAddress(city) {
    const streets = [
      'Calle Principal', 'Avenida Central', 'Paseo Reforma',
      'Boulevard Independencia', 'Carrera 5', 'Diagonal 10'
    ];
    const numbers = Math.floor(Math.random() * 9999) + 1;
    const apt = Math.floor(Math.random() * 500) + 1;
    const street = streets[Math.floor(Math.random() * streets.length)];

    return `${street} #${numbers}, Apto ${apt}, ${city}`;
  }

  generateHomeAddress(city, type) {
    const zones = {
      'Departamento': 'Zona Residencial',
      'Casa': 'Área Suburbana',
      'Rancho': 'Zona Rural',
      'Villa': 'Zona Exclusiva'
    };

    const zone = zones[type] || 'Zona Residencial';
    const number = Math.floor(Math.random() * 9999) + 1;

    return `${zone} - ${city}, Propiedad #${number}`;
  }

  generateBusinessAddress(city) {
    const areas = ['Centro', 'Zona Comercial', 'Paseo', 'Mercado', 'Plaza'];
    const area = areas[Math.floor(Math.random() * areas.length)];
    const number = Math.floor(Math.random() * 9999) + 1;

    return `${area}, ${city}, Local #${number}`;
  }

  generatePlate() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetters = Array.from({ length: 3 }, () =>
      letters[Math.floor(Math.random() * letters.length)]
    ).join('');

    const randomNumbers = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    return `${randomLetters}-${randomNumbers}`;
  }

  parseWorkDays(workDaysData) {
    const schedule = {};
    APP_CONFIG.workDays.forEach(day => {
      schedule[day.toLowerCase()] = {
        open: '09:00',
        close: '18:00'
      };
    });
    return schedule;
  }

  getTransportValue(type) {
    const values = {
      'A pie': 0,
      'Automóvil': 250000,
      'SUV': 450000,
      'Motocicleta': 150000,
      'Camión': 380000,
      'Bicicleta': 5000,
      'Taxi': 350000
    };
    return values[type] || 0;
  }

  async getSalaryForCargo(orgId, cargo) {
    try {
      const { data } = await this.supabase
        .from('org_salary_config')
        .select('salary')
        .eq('org_id', orgId)
        .eq('cargo', cargo)
        .single();

      return data?.salary || 0;
    } catch {
      return 0;
    }
  }

  // Obtener jugador actual
  getCurrentPlayer() {
    return this.currentPlayer;
  }

  // Cargar datos del jugador
  async loadPlayer(playerId) {
    try {
      const { data: player, error } = await this.supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (error) throw error;

      this.currentPlayer = player;
      localStorage.setItem('currentPlayer', JSON.stringify(player));

      return player;
    } catch (error) {
      console.error('Error cargando jugador:', error);
      return null;
    }
  }

  // Actualizar estado de rol
  async updateRoleStatus(isOnRole) {
    try {
      if (!this.currentPlayer) throw new Error('No hay jugador activo');

      await this.supabase
        .from('players')
        .update({
          is_on_role: isOnRole,
          last_activity: new Date().toISOString()
        })
        .eq('id', this.currentPlayer.id);

      this.currentPlayer.is_on_role = isOnRole;
      localStorage.setItem('currentPlayer', JSON.stringify(this.currentPlayer));

      return { success: true };
    } catch (error) {
      console.error('Error actualizando estado de rol:', error);
      return { success: false, error: error.message };
    }
  }
}

// Instancia global
const playerManager = new PlayerManager();

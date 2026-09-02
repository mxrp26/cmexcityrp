/**
 * SISTEMA DE GESTIÓN DE JUGADORES - CORREGIDO
 * Flujo en cascada: Jugador → Hogar → Empresa → Transporte → Familia → Organización
 * - Ciudades escritas manualmente por el jugador
 * - Vista previa de imágenes antes de cargar
 */

class PlayerManager {
  constructor() {
    this.supabase = null;
    this.currentPlayer = null;
    this.registrationStep = 'player';
    this.init();
  }

  async init() {
    const { createClient } = window.supabase;
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }

  // ========================================
  // PASO 1: REGISTRO DE JUGADOR/CIUDADANO
  // ========================================
  async registerPlayer(playerData) {
    try {
      const user = authManager.getCurrentUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Validar edad
      if (playerData.age < 18 || playerData.age > 120) {
        return { success: false, error: 'La edad debe estar entre 18 y 120 años' };
      }

      // Generar dirección ficticia automática basada en datos del jugador
      const address = this.generateFictionalAddress(playerData.city, playerData.characterName);

      const { data: player, error } = await this.supabase
        .from('players')
        .insert([{
          user_id: user.id,
          character_name: playerData.characterName,
          age: parseInt(playerData.age),
          gender: playerData.gender,
          blood_type: playerData.bloodType,
          city: playerData.city, // Ciudad escrita por el jugador
          address: address, // Domicilio generado automáticamente
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
        message: '✅ Ficha de ciudadano creada exitosamente. Ahora registra tu hogar.'
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
      const address = this.generateHomeAddress(this.currentPlayer.city, homeData.type, this.currentPlayer.character_name);

      const { data: home, error } = await this.supabase
        .from('homes')
        .insert([{
          player_id: this.currentPlayer.id,
          type: homeData.type,
          city: this.currentPlayer.city,
          address: address, // Domicilio ficticio generado automáticamente
          value: value, // Precio automático según tipo
          image_url: homeData.imageUrl || null
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        home,
        nextStep: 'business',
        message: `✅ ${homeData.type} registrado en ${this.currentPlayer.city}. ¿Tienes empresa?`
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
          error: `El salario no puede exceder $${APP_CONFIG.prices.maxSalary.toLocaleString()}`
        };
      }

      const openingHours = this.parseWorkDays(businessData.workDays, businessData.workHours);

      const { data: business, error } = await this.supabase
        .from('businesses')
        .insert([{
          owner_id: this.currentPlayer.id,
          business_name: businessData.name,
          business_type: businessData.giro,
          description: businessData.giro, // Giro de la empresa
          image_url: businessData.imageUrl || null,
          city: this.currentPlayer.city,
          address: this.generateBusinessAddress(this.currentPlayer.city),
          opening_hours: openingHours,
          is_online: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Actualizar ocupación del jugador
      await this.supabase
        .from('players')
        .update({ occupation: businessData.name })
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

      // Generar placa automática
      const plate = this.generatePlate();
      const value = this.getTransportValue(transportData.type);

      const { data: vehicle, error } = await this.supabase
        .from('vehicles')
        .insert([{
          player_id: this.currentPlayer.id,
          type: transportData.type,
          model: transportData.model,
          color: transportData.color,
          plate: plate, // Placa generada automáticamente
          value: value, // Valor según el tipo de transporte
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
        message: `✅ ${transportData.type} ${transportData.model} registrado con placa ${plate}. ¿Tienes familia?`
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

      if (!familyData.hasBusiness) {
        // Si el jugador seleccionó NO tiene familia, pasar al siguiente
        return {
          success: true,
          nextStep: 'organization',
          message: '✅ Continuando con el registro. ¿Perteneces a una organización?'
        };
      }

      // Si tiene familia
      let familyId = familyData.familyId;

      if (familyData.isNewFamily) {
        // Crear nueva familia
        const { data: family, error: familyError } = await this.supabase
          .from('families')
          .insert([{
            family_name: familyData.familyName,
            description: `Familia de ${this.currentPlayer.character_name}`
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

      // Actualizar jugador con familia
      await this.supabase
        .from('players')
        .update({ family_id: familyId })
        .eq('id', this.currentPlayer.id);

      return {
        success: true,
        familyId,
        nextStep: 'organization',
        message: `✅ Agregado a la familia como ${familyData.familyRole}. ¿Perteneces a una organización?`
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

      if (!orgData.isOrganization) {
        // Si no pertenece a organización, completar registro
        return {
          success: true,
          nextStep: 'complete',
          message: '✅ ¡Registro de ciudadano completado! Ahora puedes acceder al dashboard.'
        };
      }

      let organizationId = null;

      if (orgData.isLeader) {
        // ===== CREAR NUEVA ORGANIZACIÓN =====
        const { data: org, error: orgError } = await this.supabase
          .from('organizations')
          .insert([{
            org_name: orgData.orgName,
            alias: orgData.alias || null,
            logo_url: orgData.logoUrl || null,
            description: orgData.description || '',
            giro: orgData.giro,
            leader_id: this.currentPlayer.id,
            is_active: true
          }])
          .select()
          .single();

        if (orgError) throw orgError;
        organizationId = org.id;

        // Guardar configuración de salarios (máximo 20 cargos)
        if (orgData.salaries && orgData.salaries.length > 0) {
          const validSalaries = orgData.salaries
            .filter(s => s.cargo && s.salario)
            .slice(0, 20); // Máximo 20

          for (const salary of validSalaries) {
            await this.supabase
              .from('org_salary_config')
              .insert([{
                org_id: organizationId,
                cargo: salary.cargo,
                salary: parseInt(salary.salario)
              }])
              .catch(err => console.warn('Error guardando salario:', err));
          }
        }

        // Agregar líder como miembro
        await this.supabase
          .from('org_members')
          .insert([{
            org_id: organizationId,
            player_id: this.currentPlayer.id,
            cargo: 'Líder',
            salary: 0,
            is_active: true
          }]);

      } else if (orgData.joinOrgId) {
        // ===== UNIRSE A ORGANIZACIÓN EXISTENTE =====
        organizationId = orgData.joinOrgId;

        const { error: memberError } = await this.supabase
          .from('org_members')
          .insert([{
            org_id: organizationId,
            player_id: this.currentPlayer.id,
            cargo: orgData.cargo,
            salary: await this.getSalaryForCargo(organizationId, orgData.cargo),
            is_active: true
          }]);

        if (memberError) throw memberError;
      }

      // Actualizar jugador con organización
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
        message: '✅ ¡Registro completado! Bienvenido a MexCity RP. Accediendo al dashboard...'
      };
    } catch (error) {
      console.error('Error en registro de organización:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // MÉTODOS AUXILIARES
  // ========================================

  // Generar dirección ficticia con datos del jugador
  generateFictionalAddress(city, characterName) {
    const streets = [
      'Calle Principal', 'Avenida Central', 'Paseo Reforma',
      'Boulevard Independencia', 'Carrera 5', 'Diagonal 10',
      'Calle 1', 'Avenida 2', 'Pasaje 3', 'Vía Rápida'
    ];
    
    const numbers = Math.floor(Math.random() * 9999) + 1;
    const apt = Math.floor(Math.random() * 500) + 1;
    const street = streets[Math.floor(Math.random() * streets.length)];

    return `${street} #${numbers}, Apto ${apt}, ${city}`;
  }

  // Generar dirección de hogar
  generateHomeAddress(city, type, playerName) {
    const zones = {
      'Departamento': 'Zona Residencial Centro',
      'Casa': 'Área Suburbana',
      'Rancho': 'Zona Rural Alejada',
      'Villa': 'Zona Exclusiva Premium'
    };

    const zone = zones[type] || 'Zona Residencial';
    const number = Math.floor(Math.random() * 9999) + 1;

    return `${zone}, ${city} - Propiedad #${number}`;
  }

  // Generar dirección de negocio
  generateBusinessAddress(city) {
    const areas = ['Centro Comercial', 'Zona Comercial', 'Paseo Mercantil', 'Plaza de Negocios', 'Mercado'];
    const area = areas[Math.floor(Math.random() * areas.length)];
    const number = Math.floor(Math.random() * 9999) + 1;

    return `${area}, ${city}, Local #${number}`;
  }

  // Generar placa de vehículo
  generatePlate() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const state = ['CDMX', 'MICH', 'MXCTY', 'RP', 'MX'];
    
    const randomLetters = Array.from({ length: 3 }, () =>
      letters[Math.floor(Math.random() * letters.length)]
    ).join('');

    const randomNumbers = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    const stateCode = state[Math.floor(Math.random() * state.length)];

    return `${stateCode}-${randomLetters}${randomNumbers}`;
  }

  // Parsear días laborales
  parseWorkDays(workDaysArray, workHours) {
    const schedule = {};
    
    if (workDaysArray && Array.isArray(workDaysArray)) {
      workDaysArray.forEach(day => {
        schedule[day.toLowerCase()] = {
          open: workHours?.open || '09:00',
          close: workHours?.close || '18:00'
        };
      });
    }
    
    return schedule;
  }

  // Obtener valor del transporte
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

  // Obtener salario para cargo
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

  // ========================================
  // UTILIDADES DE IMAGEN
  // ========================================

  // Convertir archivo a base64 para previsualización
  async readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Subir imagen a Supabase Storage
  async uploadImage(file, folder) {
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await this.supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data } = this.supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      return null;
    }
  }

  // ========================================
  // GESTIÓN DE JUGADOR ACTIVO
  // ========================================

  getCurrentPlayer() {
    return this.currentPlayer;
  }

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

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de la base de datos
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '12345678',
    database: process.env.DB_NAME || 'examen1',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

// Verificar conexión a la base de datos
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión a la base de datos establecida.');
        connection.release();
    } catch (err) {
        console.error('❌ Error al conectar a la base de datos:', err);
        process.exit(1);
    }
})();

// Ruta para registrar un nuevo profesor
app.post('/registrar-profesor', async (req, res) => {
    const { nombre, correo, contraseña } = req.body;

    console.log('Solicitud de registro:', req.body);

    if (!nombre || !correo || !contraseña) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Validación de formato de correo electrónico
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(correo)) {
        return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    // Validación de longitud de contraseña
    if (contraseña.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    try {
        // Comprobar si el correo ya existe
        const [existingProfesor] = await pool.query('SELECT * FROM profesor WHERE correo = ?', [correo]);
        console.log('Profesores existentes:', existingProfesor);

        if (existingProfesor.length > 0) {
            return res.status(400).json({ error: 'El correo ya está en uso' });
        }

        // Encriptar la contraseña antes de guardarla
        const hashedPassword = await bcrypt.hash(contraseña, 10);

        // Insertar el nuevo profesor en la base de datos
        const query = 'INSERT INTO profesor (nombre, correo, contraseña) VALUES (?, ?, ?)';
        const [result] = await pool.query(query, [nombre, correo, hashedPassword]);

        res.status(201).json({ 
            id: result.insertId, 
            nombre, 
            correo 
        });
    } catch (err) {
        console.error('❌ Error al registrar profesor:', err);
        res.status(500).json({ error: 'Error al registrar el profesor' });
    }
});

// Ruta para iniciar sesión
app.post('/iniciar-sesion', async (req, res) => {
    const { correo, contraseña } = req.body;

    console.log('Solicitud de inicio de sesión:', req.body);

    if (!correo || !contraseña) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    try {
        // Verificar si el profesor existe en la base de datos
        const [profesor] = await pool.query('SELECT * FROM profesor WHERE correo = ?', [correo]);
        console.log('Profesor encontrado:', profesor);

        if (profesor.length === 0) {
            return res.status(400).json({ error: 'Profesor no encontrado' });
        }

        // Comparar la contraseña
        const isPasswordCorrect = await bcrypt.compare(contraseña, profesor[0].contraseña);
        
        if (!isPasswordCorrect) {
            return res.status(400).json({ error: 'Contraseña incorrecta' });
        }

        // Generar token JWT
        const secret = process.env.JWT_SECRET || 'clave_secreta_examen';
        const token = jwt.sign(
            { 
                profesorId: profesor[0].id, 
                nombre: profesor[0].nombre 
            },
            secret,
            { expiresIn: '1h' }
        );

        res.status(200).json({ 
            mensaje: 'Inicio de sesión exitoso', 
            token,
            profesor: {
                id: profesor[0].id,
                nombre: profesor[0].nombre,
                correo: profesor[0].correo
            }
        });
    } catch (err) {
        console.error('❌ Error al iniciar sesión:', err);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${port}`);
});


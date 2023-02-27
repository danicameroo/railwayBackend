import express from 'express'
import session from 'express-session'
import engine from 'consolidate';
import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import MongoStore from 'connect-mongo'
const advancedOptions = {useNewUrlParser: true, useUnifiedTopology: true}
import dotenv from 'dotenv'
import parseArgs from 'yargs/yargs'
import { fork } from 'child_process'
const yargs = parseArgs(process.argv.slice(2))

// modo fork

// pm2 start server.js --name serverModoFork --watch -- 8081

// modo cluster (se agrega el -i)

// pm2 start server.js --name serverModoCluster -i max --watch -- 8082


const { puerto} = yargs
    .default({
        puerto: 8080
    }).argv

console.log({puerto})


dotenv.config({
    path: './.env'
})


const usuarios = []

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

passport.use('register', new LocalStrategy({
    passReqToCallback: true    
}, (req, username, password, done) => {
    const { direccion } = req.body

    const usuario = usuarios.find(usuario => usuario.username == username)
    if (usuario) {
        return done('el usuario ya esta registrado')
    }

    const newUser = {
        username,
        password,
        direccion
    }
    usuarios.push(newUser)

    done(null, newUser)
}))

passport.use('login', new LocalStrategy((username, password, done) => {

    const usuario = usuarios.find(usuario => usuario.username == username)
    if (!usuario) {
        return done('no hay usuario', false)
    }

    if (usuario.password != password) {
        return done('pass incorrecta', false)
    }

    usuario.contador = 0

    return done(null, usuario)
}))

passport.serializeUser((user, done) => {
    done(null, user.username)
})

passport.deserializeUser((username, done) => {
    const usuario = usuarios.find(usuario => usuario.username == username)
    done(null, usuario)
})


const app = express()

app.use(session({
    store: MongoStore.create({
        mongoUrl: process.env.MONGO,
        mongoOptions: advancedOptions,
        ttl: 60
    }),

    secret: process.env.CLAVE_SECRETA,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 60000
    }
}))

app.use(passport.initialize())
app.use(passport.session())

app.set('views', __dirname + '/views');
app.engine('html', engine.mustache);
app.set('view engine', 'html');

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/views/register.html')
})

app.post('/register', passport.authenticate('register', { successRedirect: '/'}))


app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/datos')
    }

    res.sendFile(__dirname  + '/views/login.html')
})

app.post('/login', passport.authenticate('login', {failureRedirect: '/register', successRedirect: '/datos' }))

function requireAuthentication(req, res, next) {
    if (req.isAuthenticated()) {
        next()
    } else {
        res.redirect('/login')
    }
}

app.get('/datos', requireAuthentication, (req, res) => {
    if (!req.user.contador) {
        req.user.contador = 0
    }

    req.user.contador++

    const usuario = usuarios.find(usuario => usuario.username == req.user.username)

    res.render('datos', {
        datos: usuario,
        contador: req.user.contador
    })
})

app.get('/', (req, res) => {
    res.redirect('/datos')
})

app.get('/logout', (req, res) => {
    req.logout(err => {
        res.redirect('/login')
    })
})

app.get("/info", (req, res) => {
    res.send(`Servidor express en ${puerto} - <b> PID: ${process.pid}</b> - ${new Date().toLocaleString()}`)
    const datos = {
        argumento_de_entrada:  process.cwd(),
        sistema_operativo:  process.platform,
        version_de_node: process.version,
        memoria_total_reservada: process.memoryUsage(),
        path_de_ejecucion: process.execPath,
        id: process.pid,
    }

    res.json(datos)
})



app.get('/api/random', (req, res) => {
    const calculo = fork(path.resolve(process.cwd(), 'calculo.js'))
    calculo.on('message', result => {
        if (result == 'listo') {
            calculo.send('start')
        } else {
            res.json(result)
        }
    })
})


app.listen(puerto, () => {
    console.log(`server escuchando en el puerto ${puerto}`)
})
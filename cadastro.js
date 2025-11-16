
import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const registerForm = document.getElementById('registerForm');
const registerMessage = document.getElementById('registerMessage');

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        registerMessage.textContent = '';
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            registerMessage.style.color = '#4b5fc2';
            registerMessage.textContent = 'Conta criada com sucesso! Você pode fazer login.';
            registerForm.reset();
        } catch (error) {
            registerMessage.style.color = '#d43c3c';
            if (error.code === 'auth/email-already-in-use') {
                registerMessage.textContent = 'Este e-mail já está cadastrado.';
            } else if (error.code === 'auth/weak-password') {
                registerMessage.textContent = 'A senha deve ter pelo menos 6 caracteres.';
            } else {
                registerMessage.textContent = 'Erro ao criar conta: ' + error.message;
            }
        }
    });
}

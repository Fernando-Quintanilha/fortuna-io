import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from './firebase';

// Função de Login
export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error("Erro no login Google:", error);
        return null;
    }
}

// Função de Logout (O erro estava aqui, o nome precisa ser 'logout')
export async function logout() {
    try {
        await firebaseSignOut(auth);
        window.location.reload(); // Recarrega para limpar os dados da tela
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}
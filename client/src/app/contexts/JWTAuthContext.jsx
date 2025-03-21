import { createContext, useEffect, useReducer } from 'react';
import { jwtDecode } from 'jwt-decode';
import { api } from '../services';

const initialState = {
    user: null,
    isInitialised: false,
    isAuthenticated: false,
};

const isValidToken = (accessToken) => {
    if (!accessToken) return false;
    const decodedToken = jwtDecode(accessToken);
    const currentTime = Date.now() / 1000;
    return decodedToken.exp > currentTime;
};

const setSession = (tokenType, accessToken) => {
    if (accessToken) {
        localStorage.setItem('tokenType', tokenType);
        localStorage.setItem('accessToken', accessToken);        
        api.defaults.headers.common.Authorization = `${tokenType} ${accessToken}`;
    } else {
        localStorage.removeItem('tokenType');
        localStorage.removeItem('accessToken');
        delete api.defaults.headers.common.Authorization;
    }
};

const reducer = (state, action) => {
    switch (action.type) {
        case 'INIT': {
            const { isAuthenticated, user } = action.payload;
            return { ...state, user: user, isAuthenticated, isInitialised: true };
        }
        case 'LOGIN': {
            const { user } = action.payload;
            return { ...state, user: user, isAuthenticated: true };
        }
        case 'LOGOUT': {
            return { ...state, isAuthenticated: false, user: null };
        }
        case 'REGISTER': {
            const { user } = action.payload;
            return { ...state, isAuthenticated: true, user: user };
        }
        default: {
            return state;
        }
    }
};

const AuthContext = createContext({
    ...initialState,
    method: 'JWT',
    logout: () => {},
    login: () => Promise.resolve(),
    register: () => Promise.resolve(),
});

export const AuthProvider = ({ children }) => {
    const [ state, dispatch ] = useReducer(reducer, initialState);

    const profile = async () => {
        const { data } = await api.get('/Security/Profile');
        return data.data;
    }

    const login = async (username, password) => {
        const { data } = await api.post('/Security/SignIn', {
            username: username,
            password: password,
        });

        const { tokenType, accessToken } = data.data;

        setSession(tokenType, accessToken);

        const user = await profile();

        dispatch({ type: 'LOGIN', payload: { user: user } });
    }

    const register = async (username, email, password) => {
        const { data } = await api.post('/Security/SignUp', {
            username,
            email,
            password,
        });

        const { accessToken } = data;

        setSession(accessToken);

        const user = await profile();

        dispatch({ type: 'REGISTER', payload: { user: user } });
    };

    const logout = () => {
        setSession(null);
        dispatch({ type: 'LOGOUT' });
    };

    useEffect(() => {
        (async () => {
            try {
                const tokenType = window.localStorage.getItem('tokenType');
                const accessToken = window.localStorage.getItem('accessToken');
                if (accessToken && isValidToken(accessToken)) {
                    setSession(tokenType, accessToken);
                    const user = await profile();
                    dispatch({
                        type: 'INIT',
                        payload: { isAuthenticated: true, user: user },
                    });
                } else {
                    dispatch({
                        type: 'INIT',
                        payload: { isAuthenticated: false, user: null },
                    });
                }
            } catch (error) {
                dispatch({
                    type: 'INIT',
                    payload: { isAuthenticated: false, user: null },
                });
            }
        })();
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, method: 'JWT', login, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
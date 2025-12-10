import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
    firstName: string;
    lastName: string;
    email: string;
    isAdmin?: boolean;
    photoURL?: string;
}

interface UserContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: () => void;
    isLoading: boolean;
    logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check Session on Mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.isAuthenticated && data.user) {
                        setUser(data.user);
                    }
                }
            } catch (e) {
                console.error("Session check failed", e);
            } finally {
                setIsLoading(false);
            }
        };
        checkSession();
    }, []);

    const login = () => {
        window.location.href = "/api/auth/google";
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout');
            setUser(null);
            window.location.href = "/";
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    return (
        <UserContext.Provider value={{
            user,
            login,
            logout,
            isAuthenticated: !!user,
            isLoading
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};

import React from 'react';
import AuthForm from '@/components/auth/AuthForm';
import Logo from '@/components/ui/Logo';
const Auth = () => {
  return <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CampusLM</h1>
          <p className="text-gray-600">Tu asistente virtual 24/7 potenciado por IA desarrollado por Campus Norte UNC y basado en el conocimiento de las instituciones</p>
        </div>
        <AuthForm />
      </div>
    </div>;
};
export default Auth;
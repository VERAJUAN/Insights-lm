import React from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Users, BookOpen, ArrowRight, Sparkles } from 'lucide-react';

interface SuperAdminEmptyStateProps {
  onNavigateToOrganizations?: () => void;
  onNavigateToUsers?: () => void;
}

const SuperAdminEmptyState = ({ 
  onNavigateToOrganizations, 
  onNavigateToUsers 
}: SuperAdminEmptyStateProps) => {
  return (
    <div className="text-center py-16">
      <div className="mb-12">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-4xl font-medium text-gray-900 mb-4">
          Bienvenido al Sistema
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-2">
          El sistema está completamente vacío. Como superadministrador, puedes comenzar a configurar el sistema creando organizaciones y usuarios.
        </p>
        <p className="text-base text-gray-500 max-w-2xl mx-auto">
          Sigue estos pasos para comenzar:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6 text-center hover:border-blue-500 transition-colors">
          <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">1. Crear Organizaciones</h3>
          <p className="text-gray-600 text-sm mb-4">
            Crea organizaciones para agrupar usuarios y cuadernos
          </p>
          {onNavigateToOrganizations && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onNavigateToOrganizations}
              className="w-full"
            >
              Ir a Gestión de Org
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        <div className="bg-white rounded-lg border-2 border-gray-200 p-6 text-center hover:border-green-500 transition-colors">
          <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <Users className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">2. Crear Usuarios</h3>
          <p className="text-gray-600 text-sm mb-4">
            Crea usuarios y asígnales roles (administrador o lector) y organizaciones
          </p>
          {onNavigateToUsers && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onNavigateToUsers}
              className="w-full"
            >
              Ir a Gestión de Usuarios
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        <div className="bg-white rounded-lg border-2 border-gray-200 p-6 text-center hover:border-purple-500 transition-colors">
          <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">3. Crear Cuadernos</h3>
          <p className="text-gray-600 text-sm mb-4">
            Los administradores pueden crear cuadernos y asignarlos a lectores
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto">
        <h4 className="font-medium text-blue-900 mb-2">¿Cómo empezar?</h4>
        <ol className="text-left text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>Ve a la pestaña <strong>"Gestionar Org"</strong> para crear tu primera organización</li>
          <li>Luego ve a <strong>"Usuarios"</strong> para crear administradores y lectores</li>
          <li>Asigna usuarios a organizaciones y roles según corresponda</li>
          <li>Los administradores podrán crear cuadernos y asignarlos a lectores</li>
        </ol>
      </div>
    </div>
  );
};

export default SuperAdminEmptyState;


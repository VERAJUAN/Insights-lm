
import React, { useState } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import NotebookGrid from '@/components/dashboard/NotebookGrid';
import EmptyDashboard from '@/components/dashboard/EmptyDashboard';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrganizationPromptEditor from '@/components/admin/OrganizationPromptEditor';
import NotebookAssignment from '@/components/admin/NotebookAssignment';
import UserManagement from '@/components/admin/UserManagement';
import OrganizationsOverview from '@/components/admin/OrganizationsOverview';
import OrganizationManagement from '@/components/admin/OrganizationManagement';
import { Settings, Users, FileText, BookOpen, Building2 } from 'lucide-react';

const Dashboard = () => {
  const { user, loading: authLoading, error: authError } = useAuth();
  const { notebooks, isLoading, error, isError } = useNotebooks();
  const { isSuperadministrator, isAdministrator, isReader } = useUserRole();
  const [activeTab, setActiveTab] = useState('notebooks');
  const hasNotebooks = notebooks && notebooks.length > 0;

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader userEmail={user?.email} />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-medium text-gray-900 mb-2">Bienvenido a CampusLM</h1>
          </div>
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing...</p>
          </div>
        </main>
      </div>
    );
  }

  // Show auth error if present
  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader userEmail={user?.email} />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-medium text-gray-900 mb-2">Bienvenido a CampusLM</h1>
          </div>
          <div className="text-center py-16">
            <p className="text-red-600">Authentication error: {authError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Show notebooks loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader userEmail={user?.email} />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-medium text-gray-900 mb-2">Bienvenido a CampusLM</h1>
          </div>
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando tus cuadernos...</p>
          </div>
        </main>
      </div>
    );
  }

  // Show notebooks error if present
  if (isError && error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader userEmail={user?.email} />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-medium text-gray-900 mb-2">Bienvenido a CampusLM</h1>
          </div>
          <div className="text-center py-16">
            <p className="text-red-600">Error al cargar tus cuadernos: {error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reintentar
            </button>
          </div>
        </main>
      </div>
    );
  }

  const showAdminTabs = isSuperadministrator || isAdministrator;

  return (
    <div className="min-h-screen bg-white">
      <DashboardHeader userEmail={user?.email} />
      
      <main className="max-w-7xl mx-auto px-6 py-[60px]">
        <div className="mb-8">
          <h1 className="font-medium text-gray-900 mb-2 text-5xl">Bienvenido a CampusLM</h1>
        </div>

        {showAdminTabs ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="notebooks" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Cuadernos</span>
              </TabsTrigger>
              {isAdministrator && (
                <>
                  <TabsTrigger value="prompt" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Prompt</span>
                  </TabsTrigger>
                  <TabsTrigger value="assignments" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Asignaciones</span>
                  </TabsTrigger>
                </>
              )}
              {isSuperadministrator && (
                <>
                  <TabsTrigger value="organizations" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Organizaciones</span>
                  </TabsTrigger>
                  <TabsTrigger value="org-management" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Gestionar Org</span>
                  </TabsTrigger>
                  <TabsTrigger value="users" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Usuarios</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="notebooks" className="mt-6">
              {hasNotebooks ? <NotebookGrid /> : <EmptyDashboard />}
            </TabsContent>

            {isAdministrator && (
              <>
                <TabsContent value="prompt" className="mt-6">
                  <OrganizationPromptEditor />
                </TabsContent>
                <TabsContent value="assignments" className="mt-6">
                  <NotebookAssignment />
                </TabsContent>
              </>
            )}

            {isSuperadministrator && (
              <>
                <TabsContent value="organizations" className="mt-6">
                  <OrganizationsOverview />
                </TabsContent>
                <TabsContent value="org-management" className="mt-6">
                  <OrganizationManagement />
                </TabsContent>
                <TabsContent value="users" className="mt-6">
                  <UserManagement />
                </TabsContent>
              </>
            )}
          </Tabs>
        ) : (
          <div>
            {hasNotebooks ? <NotebookGrid /> : <EmptyDashboard />}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

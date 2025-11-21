import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAllOrganizations } from '@/hooks/useAllOrganizations';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, BookOpen, Building2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const OrganizationsOverview = () => {
  const { organizations, isLoading, error } = useAllOrganizations();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organizaciones</CardTitle>
          <CardDescription>Vista general de todas las organizaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organizaciones</CardTitle>
          <CardDescription>Vista general de todas las organizaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600">Error al cargar organizaciones</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Organizaciones
        </CardTitle>
        <CardDescription>
          Vista general de todas las organizaciones, usuarios y cuadernos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {organizations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No hay organizaciones registradas</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {organizations.map((org) => (
              <AccordionItem key={org.id} value={org.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{org.name}</span>
                      <Badge variant="outline">{org.userCount} usuarios</Badge>
                      <Badge variant="outline">{org.notebookCount} cuadernos</Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 pt-4">
                    {/* Users Section */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Usuarios ({org.userCount})
                      </h4>
                      {org.users.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay usuarios en esta organización</p>
                      ) : (
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Rol</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {org.users.map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.email}</TableCell>
                                  <TableCell>{user.full_name || '-'}</TableCell>
                                  <TableCell>
                                    {user.role === 'administrator' && (
                                      <Badge variant="default">Administrador</Badge>
                                    )}
                                    {user.role === 'reader' && (
                                      <Badge variant="secondary">Lector</Badge>
                                    )}
                                    {!user.role && (
                                      <Badge variant="outline">Sin rol</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Notebooks Section */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Cuadernos ({org.notebookCount})
                      </h4>
                      {org.notebooks.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay cuadernos en esta organización</p>
                      ) : (
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Creado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {org.notebooks.map((notebook) => (
                                <TableRow key={notebook.id}>
                                  <TableCell className="font-medium">{notebook.title}</TableCell>
                                  <TableCell>
                                    {new Date(notebook.created_at).toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Custom Prompt */}
                    {org.custom_prompt && (
                      <div>
                        <h4 className="font-medium mb-2">Prompt Personalizado</h4>
                        <div className="bg-gray-50 p-3 rounded-md border">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {org.custom_prompt}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default OrganizationsOverview;


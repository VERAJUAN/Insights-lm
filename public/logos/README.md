# Logos de Organizaciones

Esta carpeta contiene los logos de las organizaciones.

## Estructura

```
public/logos/
  └── {organization_id}/
      └── logo.{extension}
```

Ejemplo:
```
public/logos/
  └── 123e4567-e89b-12d3-a456-426614174000/
      └── logo.png
```

## Cómo funciona

1. Cuando un administrador sube un logo mediante la interfaz, la función Edge `upload-organization-logo` intenta guardar el archivo en esta carpeta.
2. En desarrollo local (Supabase CLI), el archivo se guarda automáticamente.
3. En producción, es posible que necesites guardar los archivos manualmente o usar un script.

## Notas

- Los logos se sirven estáticamente desde esta carpeta a través de Vite.
- La ruta en la base de datos será `/logos/{organization_id}/logo.{extension}`
- Los archivos deben tener un tamaño máximo de 5MB.
- Formatos permitidos: PNG, JPG, GIF, SVG, WEBP


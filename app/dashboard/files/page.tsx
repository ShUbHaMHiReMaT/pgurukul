'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Trash2, Download } from 'lucide-react';
import { useAuth } from '@/app/providers';

export default function FilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !user?.departmentId) return;

    setIsUploading(true);
    try {
      for (let file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('departmentId', user.departmentId);

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          headers: {
            'x-user-id': user.id,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setFiles([...files, data.file]);
        }
      }
    } catch (error) {
      console.error('[v0] Failed to upload file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Files</h1>
          <p className="text-muted-foreground mt-2">Upload and manage department files</p>
        </div>
        <label>
          <Button asChild className="cursor-pointer">
            <span>
              <Upload size={20} className="mr-2" />
              Upload File
            </span>
          </Button>
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Upload Area */}
      <Card className="p-8 border-2 border-dashed">
        <div className="text-center">
          <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Drop files here to upload</p>
          <p className="text-sm text-muted-foreground mt-2">
            or click the Upload button above
          </p>
        </div>
      </Card>

      {/* Files List */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Recent Files</h2>

          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-left py-3 px-4 font-medium">Size</th>
                    <th className="text-left py-3 px-4 font-medium">Uploaded</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-muted/50">
                      <td className="py-3 px-4">{file.name}</td>
                      <td className="py-3 px-4">-</td>
                      <td className="py-3 px-4">-</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button variant="outline" size="sm">
                          <Download size={16} />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

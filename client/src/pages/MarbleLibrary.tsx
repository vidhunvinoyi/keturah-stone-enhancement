import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  ExternalLink, 
  Search, 
  Plus,
  Loader2,
  FolderOpen,
  Palette,
  MapPin,
  Sparkles
} from 'lucide-react';
import { Link } from 'wouter';

interface CustomMarble {
  id: number;
  ownerId: string;
  name: string;
  origin: string | null;
  baseColor: string | null;
  veiningPattern: string | null;
  description: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  googleDriveLink: string | null;
  marbleAnalysis: string | null;
  isPublic: string;
  createdAt: Date;
  updatedAt: Date;
  analysis: {
    baseColor?: string;
    veiningColors?: string[];
    veiningPattern?: string;
    texture?: string;
    characteristics?: string;
    suggestedApplications?: string[];
  } | null;
}

export default function MarbleLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMarble, setEditingMarble] = useState<CustomMarble | null>(null);
  const [deletingMarble, setDeletingMarble] = useState<CustomMarble | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    origin: '',
    baseColor: '',
    veiningPattern: '',
    description: '',
    googleDriveLink: '',
  });

  // Fetch all custom marbles
  const { data: marbles, isLoading, refetch } = trpc.customMarble.list.useQuery();

  // Update mutation
  const updateMutation = trpc.customMarble.update.useMutation({
    onSuccess: () => {
      toast.success('Marble updated successfully');
      setEditingMarble(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update marble: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = trpc.customMarble.delete.useMutation({
    onSuccess: () => {
      toast.success('Marble deleted successfully');
      setDeletingMarble(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete marble: ${error.message}`);
    },
  });

  // Import presets mutation
  const importPresetsMutation = trpc.customMarble.importPresets.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.totalImported} marbles from Keturah Study`);
      setShowImportDialog(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to import presets: ${error.message}`);
    },
  });

  // Get available presets
  const { data: presets } = trpc.customMarble.getPresets.useQuery();

  // Filter marbles based on search query
  const filteredMarbles = marbles?.filter((marble) => {
    const query = searchQuery.toLowerCase();
    return (
      marble.name.toLowerCase().includes(query) ||
      marble.origin?.toLowerCase().includes(query) ||
      marble.baseColor?.toLowerCase().includes(query) ||
      marble.veiningPattern?.toLowerCase().includes(query)
    );
  });

  // Open edit modal
  const handleEdit = (marble: CustomMarble) => {
    setEditingMarble(marble);
    setEditForm({
      name: marble.name,
      origin: marble.origin || '',
      baseColor: marble.baseColor || '',
      veiningPattern: marble.veiningPattern || '',
      description: marble.description || '',
      googleDriveLink: marble.googleDriveLink || '',
    });
  };

  // Submit edit form
  const handleEditSubmit = () => {
    if (!editingMarble) return;
    
    updateMutation.mutate({
      id: editingMarble.id,
      name: editForm.name || undefined,
      origin: editForm.origin || undefined,
      baseColor: editForm.baseColor || undefined,
      veiningPattern: editForm.veiningPattern || undefined,
      description: editForm.description || undefined,
      googleDriveLink: editForm.googleDriveLink || undefined,
    });
  };

  // Confirm delete
  const handleDeleteConfirm = () => {
    if (!deletingMarble) return;
    deleteMutation.mutate({ id: deletingMarble.id });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">
                Marble Library
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your custom marble textures
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => setShowImportDialog(true)}
            >
              <FolderOpen className="w-4 h-4" />
              Import from Study
            </Button>
            <Link href="/#visualize">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add New Marble
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Search Bar */}
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search marbles by name, origin, or color..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!marbles || marbles.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-2">
              No Custom Marbles Yet
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start building your marble library by uploading custom marble textures 
              in the Visualize Your Space section.
            </p>
            <Link href="/#visualize">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Marble
              </Button>
            </Link>
          </motion.div>
        )}

        {/* No Results State */}
        {!isLoading && marbles && marbles.length > 0 && filteredMarbles?.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-muted-foreground">
              No marbles found matching "{searchQuery}"
            </p>
          </motion.div>
        )}

        {/* Marble Grid */}
        {!isLoading && filteredMarbles && filteredMarbles.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredMarbles.map((marble, index) => (
                <motion.div
                  key={marble.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border"
                >
                  {/* Marble Image */}
                  <div className="relative aspect-square overflow-hidden">
                    {(marble.thumbnailUrl || marble.imageUrl) ? (
                      <img
                        src={marble.thumbnailUrl || marble.imageUrl || undefined}
                        alt={marble.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <div className="text-center">
                          <Palette className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <span className="text-sm text-gray-500">No Image</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full"
                        onClick={() => handleEdit(marble)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="rounded-full"
                        onClick={() => setDeletingMarble(marble)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {marble.googleDriveLink && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="rounded-full"
                          onClick={() => window.open(marble.googleDriveLink!, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Google Drive Badge */}
                    {marble.googleDriveLink && (
                      <div className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 shadow-sm">
                        <FolderOpen className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Marble Info */}
                  <div className="p-4">
                    <h3 className="font-display text-lg font-semibold text-foreground mb-1 truncate">
                      {marble.name}
                    </h3>
                    
                    {marble.origin && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{marble.origin}</span>
                      </div>
                    )}

                    {/* Color & Pattern Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {marble.baseColor && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">
                          <Palette className="w-3 h-3" />
                          {marble.baseColor}
                        </span>
                      )}
                      {marble.analysis?.veiningPattern && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">
                          <Sparkles className="w-3 h-3" />
                          {marble.analysis.veiningPattern.split(' ').slice(0, 2).join(' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Stats Footer */}
        {marbles && marbles.length > 0 && (
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            {filteredMarbles?.length === marbles.length ? (
              <span>Showing all {marbles.length} marble{marbles.length !== 1 ? 's' : ''}</span>
            ) : (
              <span>Showing {filteredMarbles?.length} of {marbles.length} marble{marbles.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingMarble} onOpenChange={() => setEditingMarble(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Marble Details</DialogTitle>
            <DialogDescription>
              Update the information for this marble texture.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Preview Image */}
            {editingMarble && (
              <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
                {editingMarble.imageUrl ? (
                  <img
                    src={editingMarble.imageUrl}
                    alt={editingMarble.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <div className="text-center">
                      <Palette className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <span className="text-sm text-gray-500">Preset Marble - No Image</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="name">Marble Name *</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="e.g., Calacatta Gold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="origin">Origin</Label>
                <Input
                  id="origin"
                  value={editForm.origin}
                  onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })}
                  placeholder="e.g., Carrara, Italy"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="baseColor">Base Color</Label>
                <Input
                  id="baseColor"
                  value={editForm.baseColor}
                  onChange={(e) => setEditForm({ ...editForm, baseColor: e.target.value })}
                  placeholder="e.g., White with gold"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="veiningPattern">Veining Pattern</Label>
              <Input
                id="veiningPattern"
                value={editForm.veiningPattern}
                onChange={(e) => setEditForm({ ...editForm, veiningPattern: e.target.value })}
                placeholder="e.g., Bold dramatic veining"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Describe this marble's characteristics..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="googleDriveLink">Google Drive Link</Label>
              <Input
                id="googleDriveLink"
                value={editForm.googleDriveLink}
                onChange={(e) => setEditForm({ ...editForm, googleDriveLink: e.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMarble(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditSubmit}
              disabled={updateMutation.isPending || !editForm.name}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingMarble} onOpenChange={() => setDeletingMarble(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Marble</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingMarble?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import from Study Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Import Marbles from Keturah Study
            </DialogTitle>
            <DialogDescription>
              Import pre-defined marble types from the MaterialChangingStudy.pdf document. These marbles are used in the Keturah Reserve Townhouses project.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {/* Preset Marbles List */}
            <div className="space-y-4">
              {presets?.presets?.map((preset) => (
                <div 
                  key={preset.name}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div 
                    className="w-12 h-12 rounded-lg flex-shrink-0 border"
                    style={{ backgroundColor: preset.baseColor.toLowerCase().includes('white') ? '#f5f5f5' : preset.baseColor.toLowerCase().includes('gray') ? '#9ca3af' : preset.baseColor.toLowerCase().includes('black') ? '#1f2937' : '#e5e7eb' }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground">{preset.name}</h4>
                    <p className="text-sm text-muted-foreground">{preset.origin}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium">Color:</span> {preset.baseColor} | 
                      <span className="font-medium"> Veining:</span> {preset.veiningPattern}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {!presets?.presets?.length && (
              <div className="text-center py-8 text-muted-foreground">
                <Palette className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No preset marbles available</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => importPresetsMutation.mutate({ selectedMarbles: presets?.presets?.map(p => p.key as 'bardiglio' | 'statuarietto' | 'venato' | 'portoro_white' | 'portoro_gold') || [] })}
              disabled={importPresetsMutation.isPending || !presets?.presets?.length}
              className="gap-2"
            >
              {importPresetsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4" />
                  Import All ({presets?.presets?.length || 0} Marbles)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

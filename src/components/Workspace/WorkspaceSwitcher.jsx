import React, { useState, useEffect } from 'react';
import { Plus, Check, ChevronDown, Users, Video, Calendar, Loader } from 'lucide-react';

const WorkspaceSwitcher = ({ currentWorkspace, onWorkspaceChange }) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchWorkspaces();
  }, []);
  
  const fetchWorkspaces = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setWorkspaces(data.workspaces);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  };
  
  const handleWorkspaceSwitch = async (workspaceId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workspaces/${workspaceId}/switch`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('currentWorkspace', JSON.stringify(data.workspace));
        onWorkspaceChange(data.workspace);
        setIsDropdownOpen(false);
      }
    } catch (error) {
      console.error('Failed to switch workspace:', error);
    }
  };
  
  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
              currentWorkspace?.owner?.avatar 
                ? 'bg-gray-200' 
                : 'bg-blue-600'
            }`}>
              {currentWorkspace?.owner?.avatar ? (
                <img 
                  src={currentWorkspace.owner.avatar} 
                  alt="" 
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                currentWorkspace?.name?.charAt(0) || 'W'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentWorkspace?.name || 'Select Workspace'}
              </p>
              {currentWorkspace?.role && (
                <p className="text-xs text-gray-500 capitalize">
                  {currentWorkspace.role.toLowerCase()}
                </p>
              )}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
        
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <div className="py-1">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                Your Workspaces
              </div>
              
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceSwitch(workspace.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      workspace.owner?.avatar 
                        ? 'bg-gray-200' 
                        : 'bg-blue-600'
                    }`}>
                      {workspace.owner?.avatar ? (
                        <img 
                          src={workspace.owner.avatar} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        workspace.name.charAt(0)
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {workspace.name}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="capitalize">{workspace.role.toLowerCase()}</span>
                        <span className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {workspace._count.members}
                        </span>
                        <span className="flex items-center">
                          <Video className="w-3 h-3 mr-1" />
                          {workspace._count.videos}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {currentWorkspace?.id === workspace.id && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </button>
              ))}
              
              <div className="border-t border-gray-100 mt-1">
                <button
                  onClick={() => {
                    setIsCreateModalOpen(true);
                    setIsDropdownOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 flex items-center space-x-3 text-blue-600"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Create New Workspace</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newWorkspace) => {
          setWorkspaces(prev => [newWorkspace, ...prev]);
          onWorkspaceChange(newWorkspace);
          localStorage.setItem('currentWorkspace', JSON.stringify(newWorkspace));
          setIsCreateModalOpen(false);
        }}
      />
    </>
  );
};

const CreateWorkspaceModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slug: ''
  });
  const [slugValidation, setSlugValidation] = useState({ available: null, checking: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', description: '', slug: '' });
      setSlugValidation({ available: null, checking: false });
      setError('');
    }
  }, [isOpen]);
  
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  
  const checkSlug = async (slug) => {
    if (!slug || slug.length < 3) {
      setSlugValidation({ available: null, checking: false });
      return;
    }
    
    setSlugValidation(prev => ({ ...prev, checking: true }));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workspaces/check-slug', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ slug })
      });
      
      const data = await response.json();
      setSlugValidation({ available: data.available, checking: false });
    } catch (error) {
      console.error('Slug check error:', error);
      setSlugValidation({ available: null, checking: false });
    }
  };
  
  const debouncedCheckSlug = debounce(checkSlug, 500);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    
    if (name === 'slug') {
      debouncedCheckSlug(value);
    }
    
    // Auto-generate slug from name
    if (name === 'name' && !formData.slug) {
      const autoSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      
      if (autoSlug) {
        setFormData(prev => ({ ...prev, slug: autoSlug }));
        debouncedCheckSlug(autoSlug);
      }
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Workspace name is required');
      return;
    }
    
    if (slugValidation.available === false) {
      setError('Please choose a different workspace name or slug');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          slug: formData.slug.trim() || undefined
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSuccess(data.workspace);
      } else {
        setError(data.error || 'Failed to create workspace');
      }
    } catch (error) {
      console.error('Create workspace error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create New Workspace</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Workspace Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter workspace name"
            />
          </div>
          
          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
              Workspace URL
            </label>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-1">contentfactory.com/</span>
              <div className="flex-1 relative">
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  value={formData.slug}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-8 ${
                    slugValidation.checking ? 'border-blue-300' :
                    slugValidation.available === true ? 'border-green-500' :
                    slugValidation.available === false ? 'border-red-500' :
                    'border-gray-300'
                  }`}
                  placeholder="workspace-url"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {slugValidation.checking && <Loader className="w-4 h-4 text-blue-500 animate-spin" />}
                  {slugValidation.available === true && <Check className="w-4 h-4 text-green-500" />}
                  {slugValidation.available === false && <span className="text-red-500">✕</span>}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to auto-generate from name
            </p>
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe your workspace (optional)"
            />
          </div>
        </form>
        
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || slugValidation.available === false}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Workspace'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSwitcher;
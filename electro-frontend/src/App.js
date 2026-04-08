import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Projects from './pages/Projects';
import ProjectForm from './pages/ProjectForm';
import ProjectDetail from './pages/ProjectDetail';
import RoomForm from './pages/RoomForm';
import Appliances from './pages/Appliances';
import ProjectApplianceForm from './pages/ProjectApplianceForm';
import FloorPlan3D from './pages/FloorPlan3D';
import StepByStepCalculator from './pages/StepByStepCalculator';
import RoomNotes from './pages/RoomNotes';
import Support from './pages/Support';

// Admin pages
import Users from './pages/admin/Users';
import AdminAppliances from './pages/admin/AdminAppliances';
import AdminElectricalSymbols from './pages/admin/AdminElectricalSymbols';
import RoomTypes from './pages/admin/RoomTypes';
import AdminProjects from './pages/admin/AdminProjects';
import AdminProjectDetail from './pages/admin/AdminProjectDetail';
import Statistics from './pages/admin/Statistics';
import AdminManufacturers from './pages/admin/AdminManufacturers';
import ManufacturerDetail from './pages/ManufacturerDetail';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            {/* Designer routes */}
            <Route
              path="/projects"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <Projects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/new"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <ProjectForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/edit"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <ProjectForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/rooms/new"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <RoomForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/rooms/:roomId/edit"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <RoomForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/rooms/:roomId/notes"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <RoomNotes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appliances"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <Appliances />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manufacturers/:id"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <ManufacturerDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/appliances/new"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <ProjectApplianceForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/appliances/:projectApplianceId/edit"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <ProjectApplianceForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/floor-plan"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <FloorPlan3D />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/floor-plan/3d"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <FloorPlan3D />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/calculator"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <StepByStepCalculator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calculator"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <StepByStepCalculator />
                </ProtectedRoute>
              }
            />
            {/* Admin routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/appliances"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <AdminAppliances />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manufacturers"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <AdminManufacturers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/electrical-symbols"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <AdminElectricalSymbols />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/room-types"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <RoomTypes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/projects"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <AdminProjects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/projects/:id"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <AdminProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/statistics"
              element={
                <ProtectedRoute requiredRoles={['ADMIN']}>
                  <Statistics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute requiredRoles={['DESIGNER', 'ADMIN']}>
                  <Support />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;

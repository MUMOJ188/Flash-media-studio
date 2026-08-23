# Flash Media Studio

## Client Job Management System

Flash Media Studio is a full-stack client job management system designed to digitize and streamline the management of media studio operations. The system provides a centralized platform for managing clients, projects, job assignments, payments, and workflow progress.

## Overview

The system allows a media studio to manage the complete lifecycle of a client job, from client registration and project creation to job tracking and completion.

It replaces manual record keeping with a structured web-based system backed by a relational database.

## Key Features

### Client Management
- Register and manage client information
- View client profiles and contact details
- Maintain client records in a centralized database
- Track client-related projects

### Job & Project Management
- Create and manage client projects
- Assign jobs and track their progress
- Monitor project status throughout the workflow
- Maintain project-related information

### Dashboard
- Centralized dashboard for monitoring studio operations
- Overview of clients and active projects
- Quick access to important system functions
- Organized presentation of operational data

### Authentication & Security
- User authentication
- Protected application routes
- Role-based access where applicable
- Secure database communication
- Environment variables used for sensitive configuration

### Database Management
- Relational PostgreSQL database
- Structured tables and relationships
- Persistent storage of client and project data
- Database queries for retrieving and updating records

## Technologies Used

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

### Backend & Database
- Supabase
- PostgreSQL
- Supabase Authentication

### Development Tools
- Git
- GitHub
- npm
- Visual Studio Code

## System Architecture

The application follows a modern client-server architecture:

```text
User
 │
 ▼
React + TypeScript Frontend
 │
 ├── UI Components
 ├── Forms & Validation
 ├── Application Logic
 └── Authentication
 │
 ▼
Supabase
 │
 ├── Authentication
 ├── PostgreSQL Database
 └── Database API
 │
 ▼
Persistent Application Data

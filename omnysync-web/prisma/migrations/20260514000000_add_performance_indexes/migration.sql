-- Performance indexes for Document table
CREATE INDEX "Document_organizationId_status_idx" ON "Document"("organizationId", "status");
CREATE INDEX "Document_organizationId_syncStatus_idx" ON "Document"("organizationId", "syncStatus");
CREATE INDEX "Document_userId_createdAt_idx" ON "Document"("userId", "createdAt" DESC);
CREATE INDEX "Document_sourceConnectorId_idx" ON "Document"("sourceConnectorId");
CREATE INDEX "Document_destConnectorId_idx" ON "Document"("destConnectorId");
CREATE INDEX "Document_lastSyncedAt_idx" ON "Document"("lastSyncedAt");

-- Performance indexes for SyncLog table
CREATE INDEX "SyncLog_documentId_createdAt_idx" ON "SyncLog"("documentId", "createdAt" DESC);
CREATE INDEX "SyncLog_organizationId_createdAt_status_idx" ON "SyncLog"("organizationId", "createdAt" DESC, "status");

-- Performance indexes for Connector table
CREATE INDEX "Connector_organizationId_status_idx" ON "Connector"("organizationId", "status");
CREATE INDEX "Connector_type_idx" ON "Connector"("type");

-- Performance indexes for UserOrganization table
CREATE INDEX "UserOrganization_organizationId_idx" ON "UserOrganization"("organizationId");
CREATE INDEX "UserOrganization_userId_role_idx" ON "UserOrganization"("userId", "role");
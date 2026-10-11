-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "GameRole" AS ENUM ('TANK', 'SUPPORT', 'DPS');

-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('SOLO', 'TEAM');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'CHECK_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BandaiSupportStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TEAM_INVITE', 'TOURNAMENT_INVITE', 'TOURNAMENT_JOIN', 'TOURNAMENT_CHECK_IN', 'MATCH_RESULT', 'DRAFT_TURN', 'TOURNAMENT_PRIZE', 'GENERAL');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('CAPTAIN', 'MEMBER', 'SUBSTITUTE');

-- CreateEnum
CREATE TYPE "DraftAction" AS ENUM ('BAN', 'PICK');

-- CreateEnum
CREATE TYPE "DraftPhase" AS ENUM ('ROLE_BAN', 'HERO_BAN', 'HERO_PICK');

-- CreateEnum
CREATE TYPE "OrganizerPermission" AS ENUM ('MANAGE_TOURNAMENT', 'MANAGE_SCORES', 'MANAGE_DRAFT', 'MANAGE_PARTICIPANTS', 'MANAGE_BANS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "discordId" TEXT,
    "discordUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleFr" TEXT NOT NULL,
    "messageEn" TEXT NOT NULL,
    "messageFr" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "captainId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameRole" "GameRole",
    "memberRole" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "receiverId" TEXT,
    "email" TEXT,
    "username" TEXT,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TournamentType" NOT NULL,
    "format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "bandaiSupportStatus" "BandaiSupportStatus" NOT NULL DEFAULT 'NONE',
    "organizerId" TEXT NOT NULL,
    "maxTeams" INTEGER,
    "maxPlayers" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "prizesDistributedAt" TIMESTAMP(3),
    "roundSeriesLength" INTEGER NOT NULL DEFAULT 1,
    "semiSeriesLength" INTEGER NOT NULL DEFAULT 1,
    "finalSeriesLength" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentOrganizer" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" "OrganizerPermission"[],

    CONSTRAINT "TournamentOrganizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "seed" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "checkedInAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAdultConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "adultConfirmedAt" TIMESTAMP(3),
    "rulesAccepted" BOOLEAN NOT NULL DEFAULT false,
    "rulesAcceptedAt" TIMESTAMP(3),

    CONSTRAINT "TournamentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentParticipantConsent" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAdultConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "adultConfirmedAt" TIMESTAMP(3),
    "rulesAccepted" BOOLEAN NOT NULL DEFAULT false,
    "rulesAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentParticipantConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "team1Id" TEXT,
    "team2Id" TEXT,
    "score1" INTEGER NOT NULL DEFAULT 0,
    "score2" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "winnerId" TEXT,
    "playedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchChatMessage" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPrizeCode" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "placement" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "grantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentPrizeCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPrizeGrant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "placement" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentPrizeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftConfig" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT,
    "team1Id" TEXT,
    "team2Id" TEXT,
    "spectatorToken" TEXT,
    "team1Token" TEXT,
    "team2Token" TEXT,
    "bansPerRole" INTEGER NOT NULL DEFAULT 1,
    "heroBansPerTeam" INTEGER NOT NULL DEFAULT 2,
    "picksPerTeam" INTEGER NOT NULL DEFAULT 4,
    "banTimeSeconds" INTEGER NOT NULL DEFAULT 45,
    "pickTimeSeconds" INTEGER NOT NULL DEFAULT 60,
    "currentPhase" "DraftPhase" NOT NULL DEFAULT 'HERO_BAN',
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "draftCompletedAt" TIMESTAMP(3),
    "turnStartedAt" TIMESTAMP(3),
    "heroOrderJson" JSONB,

    CONSTRAINT "DraftConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftAction_" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT,
    "phase" "DraftPhase" NOT NULL,
    "action" "DraftAction" NOT NULL,
    "order" INTEGER NOT NULL,
    "teamId" TEXT,
    "actorId" TEXT,
    "gameRole" "GameRole",
    "heroName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftAction__pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleBan" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameRole" "GameRole" NOT NULL,
    "reason" TEXT,
    "bannedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hero" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "gameRole" "GameRole" NOT NULL,
    "imageUrl" TEXT,
    "officialId" TEXT,
    "summaryEn" TEXT,
    "summaryFr" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Hero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Team_captainId_idx" ON "Team"("captainId");

-- CreateIndex
CREATE INDEX "Team_tournamentId_idx" ON "Team"("tournamentId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");

-- CreateIndex
CREATE INDEX "TeamInvite_teamId_idx" ON "TeamInvite"("teamId");

-- CreateIndex
CREATE INDEX "TeamInvite_receiverId_idx" ON "TeamInvite"("receiverId");

-- CreateIndex
CREATE INDEX "TeamInvite_email_idx" ON "TeamInvite"("email");

-- CreateIndex
CREATE INDEX "TeamInvite_username_idx" ON "TeamInvite"("username");

-- CreateIndex
CREATE INDEX "Tournament_organizerId_idx" ON "Tournament"("organizerId");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentOrganizer_tournamentId_userId_key" ON "TournamentOrganizer"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "TournamentEntry_tournamentId_idx" ON "TournamentEntry"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntry_tournamentId_userId_key" ON "TournamentEntry"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntry_tournamentId_teamId_key" ON "TournamentEntry"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "TournamentParticipantConsent_tournamentId_idx" ON "TournamentParticipantConsent"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentParticipantConsent_userId_idx" ON "TournamentParticipantConsent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipantConsent_tournamentId_userId_key" ON "TournamentParticipantConsent"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- CreateIndex
CREATE INDEX "MatchChatMessage_matchId_createdAt_idx" ON "MatchChatMessage"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchChatMessage_userId_idx" ON "MatchChatMessage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPrizeCode_grantId_key" ON "TournamentPrizeCode"("grantId");

-- CreateIndex
CREATE INDEX "TournamentPrizeCode_tournamentId_placement_idx" ON "TournamentPrizeCode"("tournamentId", "placement");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPrizeCode_tournamentId_code_key" ON "TournamentPrizeCode"("tournamentId", "code");

-- CreateIndex
CREATE INDEX "TournamentPrizeGrant_tournamentId_idx" ON "TournamentPrizeGrant"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentPrizeGrant_userId_idx" ON "TournamentPrizeGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPrizeGrant_tournamentId_userId_key" ON "TournamentPrizeGrant"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftConfig_matchId_key" ON "DraftConfig"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftConfig_spectatorToken_key" ON "DraftConfig"("spectatorToken");

-- CreateIndex
CREATE UNIQUE INDEX "DraftConfig_team1Token_key" ON "DraftConfig"("team1Token");

-- CreateIndex
CREATE UNIQUE INDEX "DraftConfig_team2Token_key" ON "DraftConfig"("team2Token");

-- CreateIndex
CREATE INDEX "DraftConfig_tournamentId_idx" ON "DraftConfig"("tournamentId");

-- CreateIndex
CREATE INDEX "DraftAction__tournamentId_idx" ON "DraftAction_"("tournamentId");

-- CreateIndex
CREATE INDEX "DraftAction__matchId_idx" ON "DraftAction_"("matchId");

-- CreateIndex
CREATE INDEX "RoleBan_tournamentId_idx" ON "RoleBan"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleBan_tournamentId_userId_gameRole_key" ON "RoleBan"("tournamentId", "userId", "gameRole");

-- CreateIndex
CREATE UNIQUE INDEX "Hero_nameEn_key" ON "Hero"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "Hero_officialId_key" ON "Hero"("officialId");

-- CreateIndex
CREATE INDEX "Hero_gameRole_idx" ON "Hero"("gameRole");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentOrganizer" ADD CONSTRAINT "TournamentOrganizer_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentOrganizer" ADD CONSTRAINT "TournamentOrganizer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipantConsent" ADD CONSTRAINT "TournamentParticipantConsent_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipantConsent" ADD CONSTRAINT "TournamentParticipantConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchChatMessage" ADD CONSTRAINT "MatchChatMessage_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchChatMessage" ADD CONSTRAINT "MatchChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchChatMessage" ADD CONSTRAINT "MatchChatMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPrizeCode" ADD CONSTRAINT "TournamentPrizeCode_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPrizeCode" ADD CONSTRAINT "TournamentPrizeCode_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "TournamentPrizeGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPrizeGrant" ADD CONSTRAINT "TournamentPrizeGrant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPrizeGrant" ADD CONSTRAINT "TournamentPrizeGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPrizeGrant" ADD CONSTRAINT "TournamentPrizeGrant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftConfig" ADD CONSTRAINT "DraftConfig_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftConfig" ADD CONSTRAINT "DraftConfig_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftConfig" ADD CONSTRAINT "DraftConfig_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftConfig" ADD CONSTRAINT "DraftConfig_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftAction_" ADD CONSTRAINT "DraftAction__tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftAction_" ADD CONSTRAINT "DraftAction__teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftAction_" ADD CONSTRAINT "DraftAction__actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBan" ADD CONSTRAINT "RoleBan_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBan" ADD CONSTRAINT "RoleBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import { prisma } from "../src/db.js";
import { clerkClient } from "@clerk/express";

const syncClerkWorkspaces = async (userId) => {
  const [clerkUser, memberships] = await Promise.all([
    clerkClient.users.getUser(userId),
    clerkClient.users.getOrganizationMembershipList({ userId }),
  ]);

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
      image: clerkUser.imageUrl || "",
    },
    create: {
      id: userId,
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
      image: clerkUser.imageUrl || "",
    },
  });

  for (const membership of memberships.data) {
    const organization = membership.organization;

    await prisma.workspace.upsert({
      where: { id: organization.id },
      update: {
        name: organization.name,
        slug: organization.slug,
        image_url: organization.imageUrl || "",
      },
      create: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
                ownerId: userId,
        image_url: organization.imageUrl || "",
      },
    });

    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: organization.id,
        },
      },
      update: {
        role: membership.role === "org:admin" ? "ADMIN" : "MEMBER",
      },
      create: {
        userId,
        workspaceId: organization.id,
        role: membership.role === "org:admin" ? "ADMIN" : "MEMBER",
      },
    });
  }
};

export const getUserWorkspaces = async (req, res) => {
    try {
    const { userId } = await req.auth();
    await syncClerkWorkspaces(userId);
        const workspaces = await prisma.workspace.findMany({
            where: {
        members: { some: { userId } },
            },
            include: {
        members: { include: { user: true } },
                projects: {
          include: {
            tasks: {
              include: {
                assignee: true,
                comments: { include: { user: true } },
              },
            },
            owner: true,
          },
        },
      },
        });
        res.json({ workspaces });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const addMember = async (req, res) => {
  try{
      const {userId} = await req.auth();
      const { email, role, workspaceId, message } = req.body;

      const user = await prisma.user.findUnique({
          where: { email },
      });
      if(!user) {
          return res.status(404).json({ error: 'User not found' });
      }
      if(!workspaceId || !role) {
          return res.status(400).json({ error: 'Workspace ID and role are required' });
      }
      if(!['ADMIN', 'MEMBER'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role' });
      }
const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },include: { members: true }
      });
      if(!workspace) {
          return res.status(404).json({ error: 'Workspace not found' });
      }
      if(!workspace.members.find(member => member.userId === userId && member.role === 'ADMIN')) {
          return res.status(403).json({ error: 'Only admins can add members' });
      }
      const existingMember = workspace.members.find(member => member.userId === user.id);
      if(existingMember) {
          return res.status(400).json({ error: 'User is already a member of this workspace' });
      }
      const newMember = await prisma.workspaceMember.create({
          data: {
              userId: user.id,    
              workspaceId,role,message
          }
        });
      return res.json({ member: 'User is added as a member of this workspace' });

  }catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  };
}; 
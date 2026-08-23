import { prisma } from "../src/db.js";
import { inngest } from "../src/inngest/index.js";

export const createTask = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { projectId, title, description, type, status, priority, assigneeId: requestedAssigneeId, due_date } = req.body;
    const origin = req.get('origin');
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { user: true } } }
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }else if(project.team_lead !== userId){
      return res.status(403).json({ message: "You are not authorized to create a task in this project" });
    }
    const assigneeId = requestedAssigneeId || userId;
    if (assigneeId !== project.team_lead && !project.members.find((member) => member.userId === assigneeId)) {
      return res.status(400).json({ message: "Please select a project member as assignee" });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status,
        priority,
        type,
        due_date: new Date(due_date),
        project: { connect: { id: projectId } },
        assignee: { connect: { id: assigneeId } },
      }
    });
    const taskWithAssignee = await prisma.task.findUnique({
      where: { id: task.id },
      include: { assignee: true }
    });

    await inngest.send({
      name: "app/task.assigned",
      data:{
        taskId: task.id, origin
      }
    })

    res.json({ task: taskWithAssignee, message: "Task created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
}

export const updateTask = async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id }
    });
    if(!task){
      return res.status(404).json({message: "Task not found"});
    }
    const { userId } = await req.auth();
    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { members: { include: { user: true } } }
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }else if(project.team_lead !== userId){
      return res.status(403).json({ message: "You are not authorized to create a task in this project" });
    }

const updatedTask = await prisma.task.update({
  where: {id: req.params.id},
  data: req.body
});

    res.json({ task: taskWithAssignee, message: "Task updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
}

export const deleteTask = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { taskIds } = req.body;
    const tasks = await prisma.task.findMany({
      where: {id: {in: taskIds}}
    });
    if(tasks.length===0){
      return res.status(404).json({message: "task not found"});
    }
    const project = await prisma.project.findUnique({
      where: { id: tasks[0].projectId },
      include: { members: { include: { user: true } } }
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }else if(project.team_lead !== userId){
      return res.status(403).json({ message: "You are not authorized to create a task in this project" });
    }

    await prisma.task.deleteMany({
      where: {id: {in: taskIds}}
    })

    res.json({message: "Task deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
}

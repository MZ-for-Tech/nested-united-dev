import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Employee } from "@/lib/types/hr";
import EmployeesList from "./EmployeesList";

async function getEmployees() {
    const employees = await query<Employee>(
        `SELECT e.*, u.name as user_name
     FROM hr_employees e
     LEFT JOIN users u ON e.user_id = u.id
     ORDER BY e.status ASC, e.full_name ASC`
    );
    return employees || [];
}

async function getDepartments() {
    const depts = await query<{ department: string }>(
        `SELECT DISTINCT department FROM hr_employees WHERE department IS NOT NULL ORDER BY department`
    );
    return depts?.map((d) => d.department) || [];
}

export default async function EmployeesPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect("/login");

    const employees = await getEmployees();
    const departments = await getDepartments();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">سجل الموظفين</h1>
                    <p className="text-gray-500">{employees.length} موظف</p>
                </div>
                <Link
                    href="/hr/employees/new"
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-lg hover:shadow-xl"
                >
                    <Plus className="w-5 h-5" />
                    إضافة موظف
                </Link>
            </div>

            <EmployeesList employees={employees} departments={departments} />
        </div>
    );
}

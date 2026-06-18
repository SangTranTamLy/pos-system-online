import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import AdminLayout from "../../layouts/AdminLayout";
import {
  fetchUsers,
  fetchRoles,
  createUser,
  updateUser,
  updateUserStatus,
  type User,
  type Role,
} from "../../api/users.api";

export default function EmployeePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    roleId: "",
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([fetchUsers(), fetchRoles()]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error: any) {
      toast.error(error.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        fullName: user.fullName,
        email: user.email,
        password: "", // Không hiển thị password cũ
        roleId: user.roleId,
        isActive: user.isActive,
      });
    } else {
      setEditingUser(null);
      setFormData({
        fullName: "",
        email: "",
        password: "",
        roleId: roles.length > 0 ? roles[0].id : "",
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          ...formData,
          password: formData.password || undefined,
        });
        toast.success("Cập nhật nhân viên thành công");
      } else {
        await createUser({
          ...formData,
        });
        toast.success("Tạo nhân viên thành công");
      }
      handleCloseModal();
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await updateUserStatus(user.id, !user.isActive);
      toast.success(user.isActive ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  return (
    <AdminLayout title="Quản lý nhân viên" subtitle="Thêm, sửa và phân quyền tài khoản">
      <div className="p-2 sm:p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-gray-800 hidden sm:block">Danh sách nhân viên</h1>
          <button
            onClick={() => handleOpenModal()}
            className="bg-[#f97316] hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow transition-colors text-sm font-semibold ml-auto"
          >
            + Thêm nhân viên
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">Đang tải...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-160">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-semibold text-slate-600">Họ tên</th>
                    <th className="p-4 font-semibold text-slate-600">Email</th>
                    <th className="p-4 font-semibold text-slate-600 text-center">Vai trò</th>
                    <th className="p-4 font-semibold text-slate-600 text-center">Trạng thái</th>
                    <th className="p-4 font-semibold text-slate-600 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-[#0b1c30]">{user.fullName}</td>
                      <td className="p-4 text-slate-600">{user.email}</td>
                      <td className="p-4 text-center">
                        <span className="bg-orange-50 text-[#f97316] text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                          {user.roleName}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                            user.isActive
                              ? "bg-green-50 text-green-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {user.isActive ? "Hoạt động" : "Bị khóa"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="text-blue-600 hover:text-blue-800 mr-4 font-semibold text-sm"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`${
                            user.isActive ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"
                          } font-semibold text-sm`}
                        >
                          {user.isActive ? "Khóa" : "Mở khóa"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Chưa có nhân viên nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-[#0b1c30]/45 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold mb-4 text-[#0b1c30]">
                {editingUser ? "Cập nhật nhân viên" : "Thêm nhân viên mới"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Họ tên</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
                    placeholder="Nhập họ tên"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
                    placeholder="Nhập email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Mật khẩu {editingUser && "(Bỏ trống nếu không đổi)"}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
                    placeholder="Nhập mật khẩu"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Vai trò</label>
                  <select
                    required
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] bg-white"
                  >
                    <option value="" disabled>Chọn vai trò</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#f97316] text-white rounded-lg hover:bg-orange-600 font-semibold shadow-sm"
                  >
                    {editingUser ? "Cập nhật" : "Lưu"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

import re

path = 'C:/Users/admin/scheduler-frontend/scheduler-frontend/src/layouts/DashboardLayout.jsx'
with open(path, 'r') as f:
    content = f.read()

# Fix the template literal - remove backslash continuations
new_aside_class = '''        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[90vw] flex-col transition-transform duration-200 md:fixed md:top-0 md:h-screen md:flex md:flex-col md:w-64 md:border-r md:border-gray-200 md:bg-white md:z-30 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}>'''

# Match the old aside className (with backslash continuations)
content = re.sub(
    r'className={`fixed.*?`}>',
    new_aside_class,
    content,
    count=1,
    flags=re.DOTALL
)

with open(path, 'w') as f:
    f.write(content)
print('Fixed aside className!')
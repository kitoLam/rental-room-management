import { useParams } from 'react-router'
import { BranchForm, ExistingBranchForm } from './branch-shared'
import { OwnerPage } from './components'
export function OwnerBranchEditor() {
  const { branchId } = useParams()
  return (
    <OwnerPage title={branchId ? 'Sửa chi nhánh' : 'Tạo chi nhánh'}>
      {branchId ? <ExistingBranchForm id={branchId} /> : <BranchForm />}
    </OwnerPage>
  )
}

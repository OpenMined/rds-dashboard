from typing import List, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from syft_datasets import Dataset as DatasetModel
from syft_rds.models import Job as JobModel

from .sources import ShopifySource


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class Dataset(BaseSchema, DatasetModel):
    private_size: int = Field(default=0)
    mock_size: int = Field(default=0)
    source: Union[None, ShopifySource] = Field(default=None)


class Job(BaseSchema, JobModel):
    pass


class ListDatasetsResponse(BaseSchema):
    datasets: List[Dataset]


class ListJobsResponse(BaseSchema):
    jobs: List[Job]


class ListAutoApproveResponse(BaseSchema):
    datasites: List[str]

# Standard library imports
from typing import List, Literal, Union

# Third-party imports
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Local imports
from syft_rds.models.models import Dataset as SyftDataset, Job as SyftJob

from .sources import ShopifySource


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class Dataset(BaseSchema, SyftDataset):
    private_size: int = Field(default=0)
    mock_size: int = Field(default=0)
    source: Union[None, ShopifySource] = Field(default=None)


class Job(BaseSchema, SyftJob):
    pass


class ListDatasetsResponse(BaseSchema):
    datasets: List[Dataset]


class ListJobsResponse(BaseSchema):
    jobs: List[Job]


class ListAutoApproveResponse(BaseSchema):
    datasites: List[str]
